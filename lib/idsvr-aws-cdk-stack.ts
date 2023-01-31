import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { aws_cloudwatch as cloudwatch } from 'aws-cdk-lib';
import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbtargets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import * as replaceInFile from 'replace-in-file';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ApplicationProtocol, Protocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { GroupMetrics } from 'aws-cdk-lib/aws-autoscaling';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export class IdsvrAwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // load .env file variables
    dotenv.config();

    // Validate Environment variables
    const environmentVariables = {
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD?.trim() || '',
      ADMIN_SERVICE_ROLE: process.env.ADMIN_SERVICE_ROLE?.trim() || 'admin',
      AWS_SSH_KEY_NAME: process.env.AWS_SSH_KEY_NAME?.trim() || '',
      RUNTIME_SERVICE_ROLE: process.env.RUNTIME_SERVICE_ROLE?.trim() || 'default',
      RUNTIME_MIN_NODE_COUNT: process.env.RUNTIME_MIN_NODE_COUNT?.trim() || '',
      RUNTIME_MAX_NODE_COUNT: process.env.RUNTIME_MAX_NODE_COUNT?.trim() || '',
      RUNTIME_MIN_REQUESTS_PER_NODE: process.env.RUNTIME_MIN_REQUESTS_PER_NODE?.trim() || '',
      RUNTIME_MAX_REQUESTS_PER_NODE: process.env.RUNTIME_MAX_REQUESTS_PER_NODE?.trim() || '',
      AWS_VPC_ID: process.env.AWS_VPC_ID?.trim() || '',
      AWS_VPC_DEPLOYMENT_SUBNETS_TYPE: process.env.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE?.trim() || '',
      ENABLE_CLOUDWATCH_LOGS: process.env.ENABLE_CLOUDWATCH_LOGS?.trim() || '',
      METRICS_SCRAPE_INTERVAL_IN_SECONDS: process.env.METRICS_SCRAPE_INTERVAL_IN_SECONDS?.trim() || ''
    };

    const validateEnvVariables = (environmentVariables: { [s: string]: string }) =>
      Object.entries(environmentVariables).forEach(([key, value]) => {
        if (typeof key === 'string' && value.trim().length === 0) {
          throw new Error(`${key} is missing value, please check the .env file in the root of the project`);
        }
      });

    validateEnvVariables(environmentVariables);

    // Get AWS region
    const awsRegion = process.env.CDK_DEFAULT_REGION || '';

    // Retrieve VPC information for now, provide an option to create a new VPC
    const getExistingVpc = ec2.Vpc.fromLookup(this, 'import-vpc', { vpcId: environmentVariables.AWS_VPC_ID });

    // create S3 bucket to hold the initial cluster configuration
    // const s3BucketName = `curity-cluster-config-${Math.random().toString(36).slice(2)}`;
    const clusterConfigBucket = new s3.Bucket(this, 'cluster-config-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `curity-cluster-config-${Math.random().toString(36).slice(2)}`,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Admin node Log group
    const adminNodelogGroup = new logs.LogGroup(this, 'admin-node-log-group', {
      retention: RetentionDays.INFINITE
    });

    // admin node policy document
    const adminNodeIAMPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [clusterConfigBucket.bucketArn],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`${clusterConfigBucket.bucketArn}/cluster.xml`],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          effect: environmentVariables.ENABLE_CLOUDWATCH_LOGS === 'true' ? iam.Effect.ALLOW : iam.Effect.DENY
        }),
        new iam.PolicyStatement({
          actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
          resources: [`${adminNodelogGroup.logGroupArn}:log-stream:*`, adminNodelogGroup.logGroupArn],
          effect: iam.Effect.ALLOW
        })
      ]
    });

    // Runtime node Log group
    const runtimeNodelogGroup = new logs.LogGroup(this, 'runtime-node-log-group', {
      retention: RetentionDays.INFINITE
    });

    // runtime node policy document
    const runtimeNodeIAMPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [clusterConfigBucket.bucketArn],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`${clusterConfigBucket.bucketArn}/cluster.xml`],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          effect: environmentVariables.ENABLE_CLOUDWATCH_LOGS === 'true' ? iam.Effect.ALLOW : iam.Effect.DENY
        }),
        new iam.PolicyStatement({
          actions: ['cloudformation:SignalResource'],
          resources: [cdk.Stack.of(this).stackId],
          effect: iam.Effect.ALLOW
        }),
        new iam.PolicyStatement({
          actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
          resources: [`${runtimeNodelogGroup.logGroupArn}:log-stream:*`, runtimeNodelogGroup.logGroupArn],
          effect: iam.Effect.ALLOW
        })
      ]
    });

    // create Admin node IAM Role
    const curityAdminIAMRole = new iam.Role(this, 'admin-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Curity Admin node IAM role',
      roleName: 'curity-admin-iam-role',
      inlinePolicies: { adminNodeIAMPolicy }
    });

    // create runtime node IAM Role
    const curityRuntimeIAMRole = new iam.Role(this, 'runtime-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Curity Runtime node IAM role',
      roleName: 'curity-runtime-iam-role',
      inlinePolicies: { runtimeNodeIAMPolicy }
    });

    // prepare admin ec2 instance user-data
    const adminNodeUserDataOptions = {
      files: './config/admin-userdata.txt',
      from: [
        '$bucketName',
        '$adminPassword',
        '$efsDomain',
        '$cloudWatchNamespace',
        '$awsRegion',
        /adminNodeLogGroup/g,
        '$configEncryptionKey',
        '$enableCloudwatchLogs',
        '$metricsScrapeInterval'
      ],
      to: [
        clusterConfigBucket.bucketName,
        environmentVariables.ADMIN_PASSWORD,
        process.env.AWS_EFS_DNS || '',
        process.env.CLOUDWATCH_NAMESPACE || '',
        awsRegion,
        adminNodelogGroup.logGroupName,
        process.env.CONFIG_ENCRYPTION_KEY || '',
        environmentVariables.ENABLE_CLOUDWATCH_LOGS,
        environmentVariables.METRICS_SCRAPE_INTERVAL_IN_SECONDS
      ],
      countMatches: true
    };

    replaceInFile.sync(adminNodeUserDataOptions);
    // Read user data from the file
    const rawUserData = readFileSync('./config/admin-userdata.txt', 'utf8');
    const adminNodeUserData = ec2.UserData.custom(rawUserData);

    const adminSecurityGroup = new ec2.SecurityGroup(this, 'admin-sg', {
      vpc: getExistingVpc,
      securityGroupName: 'admin-security-group',
      description: 'admin node security group',
      allowAllOutbound: true
    });

    const runtimeSecurityGroup = new ec2.SecurityGroup(this, 'runtime-sg', {
      vpc: getExistingVpc,
      securityGroupName: 'runtime-security-group',
      description: 'runtime nodes security group',
      allowAllOutbound: true
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'alb-sg', {
      vpc: getExistingVpc,
      securityGroupName: 'alb-security-group',
      description: 'ALB security group',
      allowAllOutbound: true
    });

    const trustedIPrange = process.env.TRUSTED_IP_RANGE_CIDR?.trim() || '';
    const awsCertificateArn = process.env.AWS_CERTIFICATE_ARN?.trim() || '';
    const loadBalancerIPrange = process.env.LOADBALANCER_IP_RANGE_CIDR?.trim() || '';

    // admin node security group rules
    if (awsCertificateArn.length === 0) {
      trustedIPrange.length === 0
        ? (adminSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6749), 'Allow access to 6749 port on admin node from 0.0.0.0/0'),
          adminSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access from 0.0.0.0/0'),
          runtimeSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access from 0.0.0.0/0'))
        : (adminSecurityGroup.addIngressRule(ec2.Peer.ipv4(trustedIPrange), ec2.Port.tcp(6749), 'Allow access to 6749 port on admin node from trusted IP range'),
          adminSecurityGroup.addIngressRule(ec2.Peer.ipv4(trustedIPrange), ec2.Port.tcp(22), 'Allow SSH Access from trusted IP range'),
          runtimeSecurityGroup.addIngressRule(ec2.Peer.ipv4(trustedIPrange), ec2.Port.tcp(22), 'Allow SSH Access'));
    } else {
      trustedIPrange.length === 0
        ? (adminSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access from 0.0.0.0/0'),
          runtimeSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access from 0.0.0.0/0'))
        : (adminSecurityGroup.addIngressRule(ec2.Peer.ipv4(trustedIPrange), ec2.Port.tcp(22), 'Allow SSH Access from trusted IP range'),
          runtimeSecurityGroup.addIngressRule(ec2.Peer.ipv4(trustedIPrange), ec2.Port.tcp(22), 'Allow SSH Access from trusted IP range'));

      adminSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId), ec2.Port.tcp(4465), 'ALB access');
      adminSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId), ec2.Port.tcp(6749), 'ALB access');
    }

    adminSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(runtimeSecurityGroup.securityGroupId), ec2.Port.tcp(6789), 'Runtime access');

    // runtime node security group rules
    runtimeSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId), ec2.Port.tcp(4465), 'Allow http access from load balancer only');
    runtimeSecurityGroup.addIngressRule(ec2.Peer.securityGroupId(albSecurityGroup.securityGroupId), ec2.Port.tcp(8443), 'Allow http access from load balancer only');

    // LB sg rules
    loadBalancerIPrange.length === 0
      ? albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow http Access from 0.0.0.0/0')
      : albSecurityGroup.addIngressRule(ec2.Peer.ipv4(loadBalancerIPrange), ec2.Port.tcp(80), 'Allow http Access from LB IP range');

    // find AMI lambda function
    const findLatestCurityAmiLambda = new lambda.Function(this, 'find-curity-ami', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'find-latest-curity-ami',
      memorySize: 250,
      timeout: cdk.Duration.seconds(60),
      handler: 'amilookup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'))
    });

    //  create a policy statement
    const describeImagesPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ec2:DescribeImages'],
      resources: ['*']
    });

    // 👇 attach the policy to the function's role
    findLatestCurityAmiLambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'describe-images', {
        statements: [describeImagesPolicy]
      })
    );

    // FindAMI custom resource
    const provider = new cr.Provider(this, 'custom-resource-provider', {
      onEventHandler: findLatestCurityAmiLambda,
      logRetention: logs.RetentionDays.ONE_DAY
    });

    const resource = new cdk.CustomResource(this, 'custom-resource', {
      serviceToken: provider.serviceToken,
      properties: {
        Owner: '536652696790',
        Name: 'Curity-*',
        Architecture: 'x86_64',
        Region: awsRegion
      }
    });

    // Provision Admin node & add the IAM role
    const adminEC2Instance = new ec2.Instance(this, 'curity-idsvr-admin-node', {
      vpc: getExistingVpc,
      vpcSubnets: {
        subnetType: environmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PRIVATE' ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PUBLIC
      },
      instanceType: new ec2.InstanceType(process.env.ADMIN_INSTANCE_TYPE || 't3.small'),
      machineImage: new ec2.GenericLinuxImage({
        [awsRegion]: resource.getAtt('amiId').toString()
      }),
      role: curityAdminIAMRole,
      securityGroup: adminSecurityGroup,
      keyName: environmentVariables.AWS_SSH_KEY_NAME,
      userData: adminNodeUserData
    });

    // prep runtime nodes UserData
    const runtimeadminNodeUserDataOptions = {
      files: './config/runtime-userdata.txt',
      from: [
        '$bucketName',
        '$runtimeServiceRole',
        '$awsStackId',
        '$efsDomain',
        '$cloudWatchNamespace',
        '$awsRegion',
        /runtimeNodeLogGroup/g,
        '$configEncryptionKey',
        '$enableCloudwatchLogs'
      ],
      to: [
        clusterConfigBucket.bucketName,
        environmentVariables.RUNTIME_SERVICE_ROLE,
        cdk.Stack.of(this).stackName,
        process.env.AWS_EFS_DNS || '',
        process.env.CLOUDWATCH_NAMESPACE || '',
        awsRegion,
        runtimeNodelogGroup.logGroupName,
        process.env.CONFIG_ENCRYPTION_KEY || '',
        environmentVariables.ENABLE_CLOUDWATCH_LOGS
      ],
      countMatches: true
    };

    replaceInFile.sync(runtimeadminNodeUserDataOptions);

    // Read user data from the file
    const runtimeRawUserData = readFileSync('./config/runtime-userdata.txt', 'utf8');

    const runtimeNodeUserData = ec2.UserData.custom(runtimeRawUserData);

    // create Launch template for runtime nodes ASG
    const runtimeLaunchTemplate = new ec2.LaunchTemplate(this, 'curity-idsvr-runtime', {
      instanceType: new ec2.InstanceType(process.env.RUNTIME_INSTANCE_TYPE || 't3.small'),
      launchTemplateName: 'curity-idsvr-runtime',
      keyName: environmentVariables.AWS_SSH_KEY_NAME,
      machineImage: new ec2.GenericLinuxImage({
        [awsRegion]: resource.getAtt('amiId').toString()
      }),
      userData: runtimeNodeUserData,
      securityGroup: runtimeSecurityGroup,
      role: curityRuntimeIAMRole
    });

    // create ASG using the runtime node launch template
    const runtimeAutoScalingGroup = new asg.AutoScalingGroup(this, 'runtime-asg', {
      vpc: getExistingVpc,
      autoScalingGroupName: 'runtime-asg',
      vpcSubnets: {
        subnetType: environmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PRIVATE' ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PUBLIC
      },
      launchTemplate: runtimeLaunchTemplate,
      minCapacity: +environmentVariables.RUNTIME_MIN_NODE_COUNT,
      maxCapacity: +environmentVariables.RUNTIME_MAX_NODE_COUNT,
      groupMetrics: [GroupMetrics.all()]
    });

    // create application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      loadBalancerName: 'curity-alb',
      vpc: getExistingVpc,
      internetFacing: true,
      securityGroup: albSecurityGroup
    });

    if (awsCertificateArn.length === 0) {
      const runtimeHttpListener = alb.addListener('runtime-http-listener', {
        port: 80,
        open: true
      });

      runtimeHttpListener.addTargets('runtime-nodes', {
        port: 8443,
        targets: [runtimeAutoScalingGroup],
        protocol: elbv2.ApplicationProtocol.HTTP,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: cdk.Duration.seconds(10)
        }
      });
    } else if (awsCertificateArn.length !== 0) {
      const runtimeHttpsListener = alb.addListener('runtime-https-listener', {
        port: 443,
        open: true,
        certificates: [elbv2.ListenerCertificate.fromArn(awsCertificateArn)]
      });

      runtimeHttpsListener.addTargets('runtime-nodes', {
        port: 8443,
        targets: [runtimeAutoScalingGroup],
        protocol: elbv2.ApplicationProtocol.HTTPS,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: cdk.Duration.seconds(10)
        }
      });

      const adminHttpsListener = alb.addListener('admin-https-listener', {
        port: 6749,
        protocol: ApplicationProtocol.HTTPS,
        open: true,
        certificates: [elbv2.ListenerCertificate.fromArn(awsCertificateArn)]
      });

      adminHttpsListener.addTargets('admin-node', {
        port: 6749,
        targets: [new elbtargets.InstanceTarget(adminEC2Instance)],
        protocol: elbv2.ApplicationProtocol.HTTPS,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: cdk.Duration.seconds(10)
        }
      });
      alb.addRedirect();
    }

    // runtime scaling policy
    const cfnScalingUpPolicy = new asg.CfnScalingPolicy(this, 'scaleup-policy', {
      adjustmentType: 'ChangeInCapacity',
      autoScalingGroupName: runtimeAutoScalingGroup.autoScalingGroupName,
      cooldown: '60',
      scalingAdjustment: 1
    });

    const cfnScalingDownPolicy = new asg.CfnScalingPolicy(this, 'scaledown-policy', {
      adjustmentType: 'ChangeInCapacity',
      autoScalingGroupName: runtimeAutoScalingGroup.autoScalingGroupName,
      cooldown: '60',
      scalingAdjustment: -1
    });

    // Alarms
    const scaleUpAlarm = new cloudwatch.CfnAlarm(this, 'scaleup-alarm', {
      alarmDescription: 'Scale up if number of active connections per node > $MaxRequestsPerRuntimeNode for 5 minutes',
      metrics: [
        {
          id: 'instanceCountPerNode',
          expression: 'activeConnectionCount/instanceCount',
          label: 'Number of active connections per node',
          returnData: true
        },
        {
          id: 'instanceCount',
          label: 'Number of active runtime nodes',
          metricStat: {
            metric: {
              metricName: 'GroupInServiceInstances',
              namespace: 'AWS/AutoScaling',
              dimensions: [{ name: 'AutoScalingGroupName', value: runtimeAutoScalingGroup.autoScalingGroupName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        },
        {
          id: 'activeConnectionCount',
          label: 'Number of total active connections',
          metricStat: {
            metric: {
              metricName: 'ActiveConnectionCount',
              namespace: 'AWS/ApplicationELB',
              dimensions: [{ name: 'LoadBalancer', value: alb.loadBalancerFullName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        }
      ],
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 5,
      datapointsToAlarm: 2,
      threshold: +environmentVariables.RUNTIME_MAX_REQUESTS_PER_NODE,
      alarmActions: [cfnScalingUpPolicy.attrArn]
    });

    const scaleDownAlarm = new cloudwatch.CfnAlarm(this, 'scaledown-alarm', {
      alarmDescription: 'Scale down if number of active connections per node < $MinRequestsPerRuntimeNode for 5 consecutive minutes',
      metrics: [
        {
          id: 'instanceCountPerNode',
          expression: 'activeConnectionCount/instanceCount',
          label: 'Number of active connections per node',
          returnData: true
        },
        {
          id: 'instanceCount',
          label: 'Number of active runtime nodes',
          metricStat: {
            metric: {
              metricName: 'GroupInServiceInstances',
              namespace: 'AWS/AutoScaling',
              dimensions: [{ name: 'AutoScalingGroupName', value: runtimeAutoScalingGroup.autoScalingGroupName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        },
        {
          id: 'activeConnectionCount',
          label: 'Number of total active connections',
          metricStat: {
            metric: {
              metricName: 'ActiveConnectionCount',
              namespace: 'AWS/ApplicationELB',
              dimensions: [{ name: 'LoadBalancer', value: alb.loadBalancerFullName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        }
      ],
      comparisonOperator: 'LessThanThreshold',
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      threshold: +environmentVariables.RUNTIME_MIN_REQUESTS_PER_NODE,
      alarmActions: [cfnScalingDownPolicy.attrArn]
    });

    if (environmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PUBLIC' && awsCertificateArn === '') {
      new cdk.CfnOutput(this, 'curity-admin-ui', {
        value: `https://${adminEC2Instance.instancePublicDnsName}:6749/admin`
      });
    }

    if (awsCertificateArn !== '') {
      new cdk.CfnOutput(this, 'curity-admin-ui-lb', {
        value: `https://${alb.loadBalancerDnsName}:6749/admin`
      });
    }
  }
}
