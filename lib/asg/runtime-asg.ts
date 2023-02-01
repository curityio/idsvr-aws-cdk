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
import { AutoScalingGroup, CfnScalingPolicy, GroupMetrics } from 'aws-cdk-lib/aws-autoscaling';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class RuntimeAutoScalingGroup {
  private _runtimeAutoScalingGroup: AutoScalingGroup;
  private _scaleUpPolicy: CfnScalingPolicy;
  private _scaleDownPolicy: CfnScalingPolicy;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._runtimeAutoScalingGroup = new AutoScalingGroup(stack, 'runtime-asg', {
      vpc: customOptions.existingVpc,
      autoScalingGroupName: 'runtime-asg',
      vpcSubnets: {
        subnetType: customOptions.environmentVariables.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE === 'PRIVATE' ? SubnetType.PRIVATE_WITH_EGRESS : SubnetType.PUBLIC
      },
      launchTemplate: customOptions.runtimeLaunchTemplate,
      minCapacity: +customOptions.environmentVariables.RUNTIME_MIN_NODE_COUNT,
      maxCapacity: +customOptions.environmentVariables.RUNTIME_MAX_NODE_COUNT,
      groupMetrics: [GroupMetrics.all()]
    });

    this._scaleUpPolicy = new CfnScalingPolicy(stack, 'scaleup-policy', {
      adjustmentType: 'ChangeInCapacity',
      autoScalingGroupName: this._runtimeAutoScalingGroup.autoScalingGroupName,
      cooldown: '60',
      scalingAdjustment: 1
    });

    this._scaleDownPolicy = new CfnScalingPolicy(stack, 'scaledown-policy', {
      adjustmentType: 'ChangeInCapacity',
      autoScalingGroupName: this._runtimeAutoScalingGroup.autoScalingGroupName,
      cooldown: '60',
      scalingAdjustment: -1
    });
  }

  get asgScaleUpPolicy() {
    return this._scaleUpPolicy;
  }

  get asgScaleDownPolicy() {
    return this._scaleDownPolicy;
  }

  get runtimeAutoScalingGroup() {
    return this._runtimeAutoScalingGroup;
  }
}
