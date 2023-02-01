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
import { Duration, StackProps } from 'aws-cdk-lib';
import { ApplicationLoadBalancer, ApplicationProtocol, ListenerCertificate, Protocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { InstanceTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class AwsApplicationLoadBalancer {
  private _applicationLoadBalancer: ApplicationLoadBalancer;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._applicationLoadBalancer = new ApplicationLoadBalancer(stack, 'alb', {
      loadBalancerName: 'curity-alb',
      vpc: customOptions.existingVpc,
      internetFacing: true,
      securityGroup: customOptions.albSecurityGroup
    });

    if (customOptions.environmentVariables.AWS_CERTIFICATE_ARN.length === 0) {
      const runtimeHttpListener = this._applicationLoadBalancer.addListener('runtime-http-listener', {
        port: 80,
        open: true
      });

      runtimeHttpListener.addTargets('runtime-nodes', {
        port: 8443,
        targets: [customOptions.runtimeAutoScalingGroup],
        protocol: ApplicationProtocol.HTTP,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: Duration.seconds(10)
        }
      });
    } else if (customOptions.environmentVariables.AWS_CERTIFICATE_ARN.length !== 0) {
      const runtimeHttpsListener = this._applicationLoadBalancer.addListener('runtime-https-listener', {
        port: 443,
        open: true,
        certificates: [ListenerCertificate.fromArn(customOptions.environmentVariables.AWS_CERTIFICATE_ARN)]
      });

      runtimeHttpsListener.addTargets('runtime-nodes', {
        port: 8443,
        targets: [customOptions.runtimeAutoScalingGroup],
        protocol: ApplicationProtocol.HTTPS,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: Duration.seconds(10)
        }
      });

      const adminHttpsListener = this._applicationLoadBalancer.addListener('admin-https-listener', {
        port: 6749,
        protocol: ApplicationProtocol.HTTPS,
        open: true,
        certificates: [ListenerCertificate.fromArn(customOptions.environmentVariables.AWS_CERTIFICATE_ARN)]
      });

      adminHttpsListener.addTargets('admin-node', {
        port: 6749,
        targets: [new InstanceTarget(customOptions.adminEC2Instance)],
        protocol: ApplicationProtocol.HTTPS,
        healthCheck: {
          path: '/',
          port: '4465',
          protocol: Protocol.HTTP,
          unhealthyThresholdCount: 5,
          healthyThresholdCount: 3,
          interval: Duration.seconds(10)
        }
      });
      this._applicationLoadBalancer.addRedirect();
    }
  }

  get loadBalancer() {
    return this._applicationLoadBalancer;
  }
}
