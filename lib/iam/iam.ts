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
import { Stack, StackProps } from 'aws-cdk-lib';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';
import { PolicyDocument, PolicyStatement, Effect, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class AwsIam {
  private _adminNodeIAMPolicy: PolicyDocument;
  private _runtimeNodeIAMPolicy: PolicyDocument;
  private _curityAdminIAMRole: Role;
  private _curityRuntimeIAMRole: Role;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._adminNodeIAMPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [customOptions.clusterConfigBucket.bucketArn],
          effect: Effect.ALLOW
        }),
        new PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`${customOptions.clusterConfigBucket.bucketArn}/cluster.xml`],
          effect: Effect.ALLOW
        }),
        new PolicyStatement({
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          effect: customOptions.environmentVariables.ENABLE_CLOUDWATCH_LOGS === 'true' ? Effect.ALLOW : Effect.DENY
        }),
        new PolicyStatement({
          actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
          resources: [`${customOptions.adminNodeLogGroup.logGroupArn}:log-stream:*`, customOptions.adminNodeLogGroup.logGroupArn],
          effect: Effect.ALLOW
        })
      ]
    });

    this._runtimeNodeIAMPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['s3:ListBucket'],
          resources: [customOptions.clusterConfigBucket.bucketArn],
          effect: Effect.ALLOW
        }),
        new PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`${customOptions.clusterConfigBucket.bucketArn}/cluster.xml`],
          effect: Effect.ALLOW
        }),
        new PolicyStatement({
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          effect: customOptions.environmentVariables.ENABLE_CLOUDWATCH_LOGS === 'true' ? Effect.ALLOW : Effect.DENY
        }),
        new PolicyStatement({
          actions: ['cloudformation:SignalResource'],
          resources: [Stack.of(stack).stackId],
          effect: Effect.ALLOW
        }),
        new PolicyStatement({
          actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
          resources: [`${customOptions.runtimeNodelogGroup.logGroupArn}:log-stream:*`, customOptions.runtimeNodelogGroup.logGroupArn],
          effect: Effect.ALLOW
        })
      ]
    });

    // create Admin node IAM Role
    this._curityAdminIAMRole = new Role(stack, 'admin-iam-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      description: 'Curity Admin node IAM role',
      roleName: 'curity-admin-iam-role',
      inlinePolicies: { adminNodeIAMPolicy: this._adminNodeIAMPolicy }
    });

    // create runtime node IAM Role
    this._curityRuntimeIAMRole = new Role(stack, 'runtime-iam-role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      description: 'Curity Runtime node IAM role',
      roleName: 'curity-runtime-iam-role',
      inlinePolicies: { runtimeNodeIAMPolicy: this._runtimeNodeIAMPolicy }
    });
  }

  get adminNodeIAMPolicy() {
    return this._adminNodeIAMPolicy;
  }

  get runtimeNodeIAMPolicy() {
    return this._runtimeNodeIAMPolicy;
  }

  get runtimeIAMRole() {
    return this._curityRuntimeIAMRole;
  }

  get adminIAMRole() {
    return this._curityAdminIAMRole;
  }
}
