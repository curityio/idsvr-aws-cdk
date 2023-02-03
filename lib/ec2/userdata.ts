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
import * as replaceInFile from 'replace-in-file';
import { readFileSync } from 'fs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';
import { UserData } from 'aws-cdk-lib/aws-ec2';
import path = require('path');

export class EC2UserData {
  private _adminNodeUserData: UserData;
  private _runtimeNodeUserData: UserData;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    const adminUserDataFilePath = 'config/admin-userdata.yaml';
    const runtimeUserDataFilePath = 'config/runtime-userdata.yaml';
    /* Admin node ec2 instance userdata, More Info : https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-add-user-data.html */
    const adminNodeUserDataOptions = {
      files: path.resolve(__dirname, adminUserDataFilePath),
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
        customOptions.clusterConfigBucket.bucketName,
        customOptions.environmentVariables.ADMIN_PASSWORD,
        customOptions.environmentVariables.AWS_EFS_DNS || '',
        customOptions.environmentVariables.CLOUDWATCH_NAMESPACE || '',
        customOptions.awsRegion,
        customOptions.adminNodelogGroup.logGroupName,
        customOptions.environmentVariables.CONFIG_ENCRYPTION_KEY || '',
        customOptions.environmentVariables.ENABLE_CLOUDWATCH_LOGS,
        customOptions.environmentVariables.METRICS_SCRAPE_INTERVAL_IN_SECONDS
      ],
      countMatches: true
    };

    /* Runtime node ec2 instance userdata, More Info : https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-add-user-data.html */
    const runtimeNodeUserDataOptions = {
      files: path.resolve(__dirname, runtimeUserDataFilePath),
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
        customOptions.clusterConfigBucket.bucketName,
        customOptions.environmentVariables.RUNTIME_SERVICE_ROLE,
        Stack.of(stack).stackName,
        customOptions.environmentVariables.AWS_EFS_DNS || '',
        customOptions.environmentVariables.CLOUDWATCH_NAMESPACE || '',
        customOptions.awsRegion,
        customOptions.runtimeNodelogGroup.logGroupName,
        customOptions.environmentVariables.CONFIG_ENCRYPTION_KEY || '',
        customOptions.environmentVariables.ENABLE_CLOUDWATCH_LOGS
      ],
      countMatches: true
    };

    replaceInFile.sync(runtimeNodeUserDataOptions);
    replaceInFile.sync(adminNodeUserDataOptions);

    this._adminNodeUserData = UserData.custom(readFileSync(path.resolve(__dirname, adminUserDataFilePath), 'utf8'));
    this._runtimeNodeUserData = UserData.custom(readFileSync(path.resolve(__dirname, runtimeUserDataFilePath), 'utf8'));
  }

  get adminNodeUserData() {
    return this._adminNodeUserData;
  }

  get runtimeNodeUserData() {
    return this._runtimeNodeUserData;
  }
}
