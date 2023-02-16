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
import { CfnAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class Alarms {
  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    new CfnAlarm(stack, 'scaleup-alarm', {
      alarmDescription: 'Scale up if number of active connections per node > $MaxRequestsPerRuntimeNode for 5 minutes',
      metrics: [
        {
          id: 'instanceCountPerNode',
          expression: 'activeConnectionCount/instanceCount',
          label: 'Number of active connections per node',
          returnData: true
        },
        {
          id: 'instanceCount',
          label: 'Number of active runtime nodes',
          metricStat: {
            metric: {
              metricName: 'GroupInServiceInstances',
              namespace: 'AWS/AutoScaling',
              dimensions: [{ name: 'AutoScalingGroupName', value: customOptions.runtimeAutoScalingGroup.autoScalingGroupName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        },
        {
          id: 'activeConnectionCount',
          label: 'Number of total active connections',
          metricStat: {
            metric: {
              metricName: 'ActiveConnectionCount',
              namespace: 'AWS/ApplicationELB',
              dimensions: [{ name: 'LoadBalancer', value: customOptions.loadBalancerFullName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        }
      ],
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 5,
      datapointsToAlarm: 2,
      threshold: +customOptions.environmentVariables.RUNTIME_MAX_REQUESTS_PER_NODE,
      alarmActions: [customOptions.cfnScalingUpPolicy.attrArn]
    });

    new CfnAlarm(stack, 'scaledown-alarm', {
      alarmDescription: 'Scale down if number of active connections per node < $MinRequestsPerRuntimeNode for 5 consecutive minutes',
      metrics: [
        {
          id: 'instanceCountPerNode',
          expression: 'activeConnectionCount/instanceCount',
          label: 'Number of active connections per node',
          returnData: true
        },
        {
          id: 'instanceCount',
          label: 'Number of active runtime nodes',
          metricStat: {
            metric: {
              metricName: 'GroupInServiceInstances',
              namespace: 'AWS/AutoScaling',
              dimensions: [{ name: 'AutoScalingGroupName', value: customOptions.runtimeAutoScalingGroup.autoScalingGroupName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        },
        {
          id: 'activeConnectionCount',
          label: 'Number of total active connections',
          metricStat: {
            metric: {
              metricName: 'ActiveConnectionCount',
              namespace: 'AWS/ApplicationELB',
              dimensions: [{ name: 'LoadBalancer', value: customOptions.loadBalancerFullName }]
            },
            period: 60,
            stat: 'Sum'
          },
          returnData: false
        }
      ],
      comparisonOperator: 'LessThanThreshold',
      evaluationPeriods: 5,
      datapointsToAlarm: 5,
      threshold: +customOptions.environmentVariables.RUNTIME_MIN_REQUESTS_PER_NODE,
      alarmActions: [customOptions.cfnScalingDownPolicy.attrArn]
    });
  }
}
