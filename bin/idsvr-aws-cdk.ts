#!/usr/bin/env node
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
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IdsvrAwsCdkStack } from '../lib/idsvr-aws-cdk-stack';

const app = new cdk.App();

const idsvrAwsCdkStack = new IdsvrAwsCdkStack(app, 'IdsvrAwsCdkStack', {
  stackName: 'curity-idsvr',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'This stack includes resources needed to deploy the Curity Identity Server into AWS environment'
});

// Add a tag to all constructs in the app
cdk.Tags.of(app).add('part-of', 'IdsvrAwsCdkStack');
