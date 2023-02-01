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
import { CustomResource, Duration, StackProps } from 'aws-cdk-lib';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class AwsLambda {
  _findLatestCurityAmiLambda: Function;
  _customResource: CustomResource;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._findLatestCurityAmiLambda = new Function(stack, 'find-curity-ami', {
      runtime: Runtime.NODEJS_18_X,
      functionName: 'find-latest-curity-ami',
      memorySize: 250,
      timeout: Duration.seconds(60),
      handler: 'amilookup.handler',
      code: Code.fromAsset(path.join(__dirname, '../lambda'))
    });

    //  create a policy statement
    const describeImagesPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ec2:DescribeImages'],
      resources: ['*']
    });

    //  attach the policy to the function's role
    this._findLatestCurityAmiLambda.role?.attachInlinePolicy(
      new Policy(stack, 'describe-images', {
        statements: [describeImagesPolicy]
      })
    );

    // FindAMI custom resource
    const provider = new Provider(stack, 'provider', {
      onEventHandler: this._findLatestCurityAmiLambda,
      logRetention: RetentionDays.ONE_WEEK
    });

    this._customResource = new CustomResource(stack, 'custom-resource', {
      serviceToken: provider.serviceToken,
      properties: {
        Owner: '536652696790',
        Name: 'Curity-*',
        Architecture: 'x86_64',
        Region: customOptions.awsRegion
      }
    });
  }

  get lambdaCustomResource() {
    return this._customResource;
  }

  get findLatestCurityAmiLambdaFunction() {
    return this._findLatestCurityAmiLambda;
  }
}
