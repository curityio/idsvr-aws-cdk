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
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';
import { StackProps } from 'aws-cdk-lib';
import { IpAddresses, IVpc, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export class AwsVpc {
  private _vpc: IVpc;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    if (customOptions.environmentVariables !== undefined && customOptions?.environmentVariables.AWS_VPC_ID !== '') {
      this._vpc = Vpc.fromLookup(stack, 'import-existing-vpc', { vpcId: customOptions.environmentVariables.AWS_VPC_ID });
    } else {
      this._vpc = new Vpc(stack, 'curity-idsvr-vpc', {
        maxAzs: 2,
        enableDnsHostnames: true,
        enableDnsSupport: true,
        ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
        subnetConfiguration: [
          { name: 'private', cidrMask: 24, subnetType: SubnetType.PRIVATE_WITH_EGRESS },
          { name: 'public', cidrMask: 24, subnetType: SubnetType.PUBLIC }
        ]
      });
    }
  }

  get vpc() {
    return this._vpc;
  }
}
