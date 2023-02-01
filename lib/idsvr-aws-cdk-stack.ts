/*
 * Copyright 2023 Curity AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Alarms } from './cloudwatch/alarms';
import { AwsApplicationLoadBalancer } from './alb/alb';
import { AwsSecurityGroup } from './ec2/security-group';
import { EC2UserData } from './ec2/userdata';
import { AwsIam } from './iam/iam';
import { AwsLogGroup } from './cloudwatch/log-group';
import { AwsVpc } from './vpc/vpc';
import { CfnOutput, Stack, StackProps, CustomResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ClusterConfigBucket } from './s3/cluster-config-bucket';
import { Utils } from './utils/utils';
import { AwsLambda } from './lambda/lambda';
import { AdminNodeInstance } from './ec2/admin-ec2';
import { RuntimeLaunchTemplate } from './ec2/runtime-launch-template';
import { RuntimeAutoScalingGroup } from './asg/runtime-asg';

export class IdsvrAwsCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps, customOptions?: any) {
    super(scope, id, props);
    customOptions = customOptions || {};

    const awsRegion = props?.env?.region;
    const utils: Utils = new Utils();

    /* Validate environment variables have been set*/
    utils.validateRequiredEnvironmentVariables();

    /* Import the existing VPC for creating resources*/
    const existingVpc = new AwsVpc(this, id, props, {
      environmentVariables: utils.requiredEnvironmentVariables
    });

    /* create a new S3 bucket to store the initial cluster configuration */
    const clusterConfigBucket = new ClusterConfigBucket(this, id, props, customOptions);

    /* creates log groups for admin and runtime nodes */
    const logGroup = new AwsLogGroup(this, id, props, customOptions);

    /* creates IAM roles and requires IAM policies for the nodes to write logs, read cluster configuration from the S3 bucket etc .. */
    const iamComponents = new AwsIam(this, id, props, {
      clusterConfigBucket: clusterConfigBucket,
      adminNodeLogGroup: logGroup.adminNodelogGroup,
      runtimeNodelogGroup: logGroup.runtimeNodelogGroup,
      environmentVariables: utils.requiredEnvironmentVariables
    });

    /* creates initial ec2 instance userdata fed to admin and runtime nodes */
    const ec2UserData = new EC2UserData(this, id, props, {
      clusterConfigBucket: clusterConfigBucket,
      environmentVariables: { ...utils.requiredEnvironmentVariables, ...utils.optionalEnvironmentVariables },
      adminNodelogGroup: logGroup.adminNodelogGroup,
      runtimeNodelogGroup: logGroup.runtimeNodelogGroup,
      awsRegion
    });

    /* creates security groups for admin node, runtime node and application load balancer for restricting access */
    const securityGroup = new AwsSecurityGroup(this, id, props, { existingVpc: existingVpc.vpc, environmentVariables: utils.optionalEnvironmentVariables });

    /* creates a lambda function to find Curity Identity Server latest ami available in the region */
    const findAmiLambdaResource = new AwsLambda(this, id, props, { awsRegion });

    /* Provisions Curity Identity Server Admin node */
    const adminEC2Instance = new AdminNodeInstance(this, id, props, {
      awsRegion,
      existingVpc: existingVpc.vpc,
      environmentVariables: utils.requiredEnvironmentVariables,
      lambdaResource: findAmiLambdaResource.lambdaCustomResource,
      curityAdminIAMRole: iamComponents.adminIAMRole,
      adminSecurityGroup: securityGroup.adminSecurityGroup,
      adminNodeUserData: ec2UserData.adminNodeUserData
    });

    /* creates launch template for running Curity Identity Server runtime nodes */
    const runtimeLaunchTemplate = new RuntimeLaunchTemplate(this, id, props, {
      awsRegion,
      environmentVariables: utils.requiredEnvironmentVariables,
      lambdaResource: findAmiLambdaResource.lambdaCustomResource,
      runtimeNodeUserData: ec2UserData.runtimeNodeUserData,
      runtimeSecurityGroup: securityGroup.runtimeSecurityGroup,
      curityRuntimeIAMRole: iamComponents.runtimeIAMRole
    });

    /* creates autoscaling group for Curity Identity Server runtime nodes */
    const runtimeAutoScalingGroup = new RuntimeAutoScalingGroup(this, id, props, {
      existingVpc: existingVpc.vpc,
      environmentVariables: utils.requiredEnvironmentVariables,
      runtimeLaunchTemplate: runtimeLaunchTemplate.runtimeLaunchTemplate
    });

    /* creates a layer 7 application load balancer */
    const alb = new AwsApplicationLoadBalancer(this, id, props, {
      existingVpc: existingVpc.vpc,
      albSecurityGroup: securityGroup.albSecurityGroup,
      runtimeAutoScalingGroup: runtimeAutoScalingGroup.runtimeAutoScalingGroup,
      adminEC2Instance: adminEC2Instance.adminNodeEC2Instance,
      environmentVariables: utils.optionalEnvironmentVariables
    });

    /* creates alarms for scale-up and scale-down operations */
    new Alarms(this, id, props, {
      runtimeAutoScalingGroup: runtimeAutoScalingGroup.runtimeAutoScalingGroup,
      loadBalancerFullName: alb.loadBalancer.loadBalancerFullName,
      environmentVariables: utils.requiredEnvironmentVariables,
      cfnScalingDownPolicy: runtimeAutoScalingGroup.asgScaleDownPolicy,
      cfnScalingUpPolicy: runtimeAutoScalingGroup.asgScaleUpPolicy
    });

    /* print Admin UI */
    if (utils.requiredEnvironmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PUBLIC' && utils.optionalEnvironmentVariables.AWS_CERTIFICATE_ARN === '') {
      new CfnOutput(this, 'curity-admin-ui', {
        value: `https://${adminEC2Instance.adminNodeEC2Instance.instancePublicDnsName}:6749/admin`
      });
    }

    if (utils.optionalEnvironmentVariables.AWS_CERTIFICATE_ARN !== '') {
      new CfnOutput(this, 'curity-admin-ui-lb', {
        value: `https://${alb.loadBalancer.loadBalancerDnsName}:6749/admin`
      });
    }
  }
}
