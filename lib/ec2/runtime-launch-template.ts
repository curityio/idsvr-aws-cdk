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
import { GenericLinuxImage, InstanceType, LaunchTemplate } from 'aws-cdk-lib/aws-ec2';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class RuntimeLaunchTemplate {
  private _runtimeLaunchTemplate: LaunchTemplate;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._runtimeLaunchTemplate = new LaunchTemplate(stack, 'curity-runtime-node', {
      instanceType: new InstanceType(customOptions.environmentVariables.RUNTIME_INSTANCE_TYPE),
      launchTemplateName: 'curity-runtime-node',
      keyName: customOptions.environmentVariables.AWS_EC2_KEY_PAIR_NAME,
      machineImage: new GenericLinuxImage({
        [customOptions.awsRegion]: customOptions.lambdaResource.getAtt('amiId').toString()
      }),
      userData: customOptions.runtimeNodeUserData,
      securityGroup: customOptions.runtimeSecurityGroup,
      role: customOptions.curityRuntimeIAMRole
    });
  }

  get runtimeLaunchTemplate() {
    return this._runtimeLaunchTemplate;
  }
}
