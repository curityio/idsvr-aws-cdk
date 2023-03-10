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
import { RetentionDays, LogGroup } from 'aws-cdk-lib/aws-logs';

export class AwsLogGroup {
  private _adminNodelogGroup: LogGroup;
  private _adminNodelogGroupName: string;

  private _runtimeNodeLogGroup: LogGroup;
  private _runtimeNodeLogGroupName: string;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._adminNodelogGroupName = `admin-node-log-${Math.random().toString(36).slice(2)}`;
    this._runtimeNodeLogGroupName = `runtime-node-log-${Math.random().toString(36).slice(2)}`;

    this._adminNodelogGroup = new LogGroup(stack, 'admin-node-log-group', {
      logGroupName: this._adminNodelogGroupName,
      retention: RetentionDays.INFINITE
    });

    this._runtimeNodeLogGroup = new LogGroup(stack, 'runtime-node-log-group', {
      logGroupName: this._runtimeNodeLogGroupName,
      retention: RetentionDays.INFINITE
    });
  }

  get adminNodelogGroup() {
    return this._adminNodelogGroup;
  }

  get runtimeNodelogGroup() {
    return this._runtimeNodeLogGroup;
  }
  get adminNodelogGroupName() {
    return this._adminNodelogGroupName;
  }

  get runtimeNodelogGroupName() {
    return this._runtimeNodeLogGroupName;
  }
}
