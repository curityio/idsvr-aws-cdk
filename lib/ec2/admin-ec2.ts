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
import { StackProps } from 'aws-cdk-lib';
import { SubnetType, InstanceType, GenericLinuxImage, Instance } from 'aws-cdk-lib/aws-ec2';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class AdminNodeInstance {
  private _adminEC2Instance: Instance;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._adminEC2Instance = new Instance(stack, 'curity-admin-node', {
      vpc: customOptions.existingVpc,
      vpcSubnets: {
        subnetType: customOptions.environmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PRIVATE' ? SubnetType.PRIVATE_WITH_EGRESS : SubnetType.PUBLIC
      },
      instanceType: new InstanceType(customOptions.environmentVariables.ADMIN_INSTANCE_TYPE),
      machineImage: new GenericLinuxImage({
        [customOptions.awsRegion]: customOptions.lambdaResource.getAtt('amiId').toString()
      }),
      role: customOptions.curityAdminIAMRole,
      securityGroup: customOptions.adminSecurityGroup,
      keyName: customOptions.environmentVariables.AWS_SSH_KEY_NAME,
      userData: customOptions.adminNodeUserData
    });
  }

  get adminNodeEC2Instance() {
    return this._adminEC2Instance;
  }
}
