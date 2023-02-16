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
import * as dotenv from 'dotenv';

export class Utils {
  private _requiredEnvironmentVariables: { [s: string]: string };
  private _optionalEnvVariables: { [s: string]: string };

  constructor() {
    /* Loads environment variables from `.env` file */
    dotenv.config();
    this._requiredEnvironmentVariables = {
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD?.trim() || '',
      ADMIN_SERVICE_ROLE: process.env.ADMIN_SERVICE_ROLE?.trim() || '',
      ADMIN_INSTANCE_TYPE: process.env.ADMIN_INSTANCE_TYPE?.trim() || '',
      RUNTIME_SERVICE_ROLE: process.env.RUNTIME_SERVICE_ROLE?.trim() || '',
      RUNTIME_INSTANCE_TYPE: process.env.RUNTIME_INSTANCE_TYPE?.trim() || '',
      RUNTIME_MIN_NODE_COUNT: process.env.RUNTIME_MIN_NODE_COUNT?.trim() || '',
      RUNTIME_MAX_NODE_COUNT: process.env.RUNTIME_MAX_NODE_COUNT?.trim() || '',
      RUNTIME_MIN_REQUESTS_PER_NODE: process.env.RUNTIME_MIN_REQUESTS_PER_NODE?.trim() || '',
      RUNTIME_MAX_REQUESTS_PER_NODE: process.env.RUNTIME_MAX_REQUESTS_PER_NODE?.trim() || '',
      AWS_VPC_DEPLOYMENT_SUBNETS_TYPE: process.env.AWS_VPC_DEPLOYMENT_SUBNETS_TYPE?.trim() || '',
      AWS_EC2_KEY_PAIR_NAME: process.env.AWS_EC2_KEY_PAIR_NAME?.trim() || '',
      ENABLE_CLOUDWATCH_LOGS: process.env.ENABLE_CLOUDWATCH_LOGS?.trim() || '',
      METRICS_SCRAPE_INTERVAL_IN_SECONDS: process.env.METRICS_SCRAPE_INTERVAL_IN_SECONDS?.trim() || ''
    };
    this._optionalEnvVariables = {
      AWS_VPC_ID: process.env.AWS_VPC_ID?.trim() || '',
      LOADBALANCER_IP_RANGE_CIDR: process.env.LOADBALANCER_IP_RANGE_CIDR?.trim() || '',
      TRUSTED_IP_RANGE_CIDR: process.env.TRUSTED_IP_RANGE_CIDR?.trim() || '',
      CLOUDWATCH_NAMESPACE: process.env.CLOUDWATCH_NAMESPACE?.trim() || '',
      AWS_EFS_DNS: process.env.AWS_EFS_DNS?.trim() || '',
      CONFIG_ENCRYPTION_KEY: process.env.CONFIG_ENCRYPTION_KEY?.trim() || '',
      AWS_CERTIFICATE_ARN: process.env.AWS_CERTIFICATE_ARN?.trim() || '',
      AWS_ACM_SELF_SIGNED_CERT_ARN: process.env.AWS_ACM_SELF_SIGNED_CERT_ARN || ''
    };
  }

  validateRequiredEnvironmentVariables(): void {
    Object.entries(this._requiredEnvironmentVariables).forEach(([key, value]) => {
      if (typeof key === 'string' && value.trim().length === 0) {
        throw new Error(`${key} is missing value, please provide a value in the .env file in the root of the project`);
      }
    });
  }

  get requiredEnvironmentVariables() {
    return this._requiredEnvironmentVariables;
  }

  get optionalEnvironmentVariables() {
    return this._optionalEnvVariables;
  }
}
