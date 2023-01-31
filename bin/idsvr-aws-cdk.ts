#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IdsvrAwsCdkStack } from '../lib/idsvr-aws-cdk-stack';

const app = new cdk.App();

new IdsvrAwsCdkStack(app, 'IdsvrAwsCdkStack', {
  stackName: 'curity-idsvr',
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'This stack includes resources needed to deploy the Curity Identity Server into this environment'
});
