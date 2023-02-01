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
import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class ClusterConfigBucket {
  private _bucketName: string;
  private _bucketArn: string;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    const s3bucket = new s3.Bucket(stack, 'cluster-config-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `cluster-config-bucket-${Math.random().toString(36).slice(2)}`,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: RemovalPolicy.DESTROY
    });

    this._bucketName = s3bucket.bucketName;
    this._bucketArn = s3bucket.bucketArn;
  }

  get bucketName() {
    return this._bucketName;
  }

  get bucketArn() {
    return this._bucketArn;
  }
}
