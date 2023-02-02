# Curity Identity Server AWS CDK Project

[![Quality](https://img.shields.io/badge/quality-experiment-red)](https://curity.io/resources/code-examples/status/)
[![Availability](https://img.shields.io/badge/availability-source-blue)](https://curity.io/resources/code-examples/status/)

This aws cdk project deploys a Curity Identity Server cluster in AWS cloud. The cluster is installed in a [Standalone Admin setup](https://curity.io/docs/idsvr/latest/system-admin-guide/deployment/clustering.html#standalone-admin-setup) and the cluster configuration is generated during the deployment process.

# Prepare the Installation

Installing using `aws cdk` has the following prerequisites:

- [AWS Account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured.
- [NodeJS & npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) installed. AWS CDK applications require Node.js 10.13 or later (Node.js versions 13.0.0 through 13.6.0 are not compatible with the AWS CDK due to compatibility issues with its dependencies)
- [Typescript](https://www.npmjs.com/package/typescript)
- [AWS CDK v2](https://aws.amazon.com/getting-started/guides/setup-cdk/module-two/)

## Configuration
This project provides configuration options via an `.env` file available in the root of the project.

Parameter | Description 
--- | --- 
`AdminInstanceType` | The EC2 Instance type of the Admin node 
`RuntimeInstanceType` | The EC2 Instance type of the Runtime node(s) 
`RuntimeMinNodeCount` | The minimum number of Runtime node(s) 
`RuntimeMinNodeCount` | The maximum number of Runtime node(s) 
`KeyName` | The EC2 Key Pair to allow SSH access to the ec2 instances * 
`VpcId` | VpcId of an existing Virtual Private Cloud (VPC) 
`TrustedIpRange` | The IP address range that can be used to SSH to the EC2 instances and access the Curity Admin UI 
`LoadBalancerIpRange` | The IP address range that can be used to access Curity Runtime service through the load balancer 
`CertificateArn` | The ARN of the certificate to be used by the load balancer *
`EFSDNS` | The EFS DNS for the file system containing configuration, plugins and template/translation overrides. * 
`CloudWatchNamespace` | The namespace for the metrics pushed to CloudWatch. If not set, the metrics will not be pushed to CloudWatch 
`EnableCloudWatchLogs` | Send application logs to cloudwatch
`MetricsScrapeInterval` | How often to scrape data from Curity's metrics endpoint (in seconds) 
`MaxRequestsPerRuntimeNode` | The max threshold for the number of requests per runtime node. Exceeding this for 2 times in 5 minutes will scale up the number of runtime nodes by 1 
`MinRequestsPerRuntimeNode` | The min threshold for the number of requests per runtime node. Staying under this limit for 5 consecutive minutes will scale down the number of runtime nodes by 1 
`AdminUserPassword` | Password for the admin user of the Curity configuration service 
`RuntimeServiceRole` | The Runtime service roles 
`ConfigEncryptionKey` | The key to encrypt the Curity Configuration

  * This resource has to be created beforehand.


## Installation

 1. Clone the repository
    ```sh
    git clone git@github.com:curityio/idsvr-aws-cdk.git
    cd idsvr-aws-cdk
    ```
 2. Bootstrap the CDK  
    ```sh
    cdk bootstrap
    ``` 
 3. Install cdk dependencies
    ```sh
    npm install package.json
    npm install lib/lambda/package.json
    ``` 
 4. Deploy the Curity Identity Server in the connected AWS account
    ```sh
    cdk deploy
    ```
 5. Few other useful commands
    ```sh
    - `cdk diff` compare deployed stack with current state
    - `cdk synth` emits the synthesized CloudFormation template 
    ```
## Cleanup
Run `cdk destroy` to remove the installation. 

## More Information

Please visit [curity.io](https://curity.io/) for more information about the Curity Identity Server.
