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
import { Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { IdsvrAwsCdkStack } from '../idsvr-aws-cdk-stack';

export class AwsSecurityGroup {
  private _adminSecurityGroup: SecurityGroup;
  private _runtimeSecurityGroup: SecurityGroup;
  private _albSecurityGroup: SecurityGroup;

  constructor(stack: IdsvrAwsCdkStack, id: string, props?: StackProps, customOptions?: any) {
    this._adminSecurityGroup = new SecurityGroup(stack, 'admin-sg', {
      vpc: customOptions.vpc,
      securityGroupName: 'admin-node-security-group',
      description: 'admin node security group',
      allowAllOutbound: true
    });

    this._runtimeSecurityGroup = new SecurityGroup(stack, 'runtime-sg', {
      vpc: customOptions.vpc,
      securityGroupName: 'runtime-node-security-group',
      description: 'runtime nodes security group',
      allowAllOutbound: true
    });

    this._albSecurityGroup = new SecurityGroup(stack, 'alb-sg', {
      vpc: customOptions.vpc,
      securityGroupName: 'alb-security-group',
      description: 'ALB security group',
      allowAllOutbound: true
    });

    /* Allow traffic from the load balancer to admin node */
    this._adminSecurityGroup.addIngressRule(Peer.securityGroupId(this._albSecurityGroup.securityGroupId), Port.tcp(4465), 'Allow http access from load balancer only');
    this._adminSecurityGroup.addIngressRule(Peer.securityGroupId(this._albSecurityGroup.securityGroupId), Port.tcp(6749), 'Allow http access from load balancer only');

    /* Allow traffic from the load balancer to runtime nodes */
    this._runtimeSecurityGroup.addIngressRule(Peer.securityGroupId(this._albSecurityGroup.securityGroupId), Port.tcp(4465), 'Allow http access from load balancer only');
    this._runtimeSecurityGroup.addIngressRule(Peer.securityGroupId(this._albSecurityGroup.securityGroupId), Port.tcp(8443), 'Allow http access from load balancer only');

    /* Allow traffic to load balancer from public internet or specified load balancer IP range CIDR */
    customOptions.environmentVariables.LOADBALANCER_IP_RANGE_CIDR.length === 0
      ? this._albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), 'Allow http Access from 0.0.0.0/0')
      : this._albSecurityGroup.addIngressRule(Peer.ipv4(customOptions.environmentVariables.LOADBALANCER_IP_RANGE_CIDR), Port.tcp(80), 'Allow http Access from LB IP range');

    /* Allow SSH access to admin node & runtime nodes */
    customOptions.environmentVariables.TRUSTED_IP_RANGE_CIDR.length === 0
      ? (this._adminSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH Access to admin node from 0.0.0.0/0'),
        this._runtimeSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH Access to runtime node from 0.0.0.0/0'))
      : (this._adminSecurityGroup.addIngressRule(
          Peer.ipv4(customOptions.environmentVariables.TRUSTED_IP_RANGE_CIDR),
          Port.tcp(22),
          'Allow SSH Access to admin node from trusted IP range'
        ),
        this._runtimeSecurityGroup.addIngressRule(
          Peer.ipv4(customOptions.environmentVariables.TRUSTED_IP_RANGE_CIDR),
          Port.tcp(22),
          'Allow SSH Access to runtime node from trusted IP range'
        ));

    /* Allow runtime node to access admin node */
    this._adminSecurityGroup.addIngressRule(Peer.securityGroupId(this._runtimeSecurityGroup.securityGroupId), Port.tcp(6789), 'Runtime access');
  }

  get adminSecurityGroup() {
    return this._adminSecurityGroup;
  }

  get runtimeSecurityGroup() {
    return this._runtimeSecurityGroup;
  }

  get albSecurityGroup() {
    return this._albSecurityGroup;
  }
}
