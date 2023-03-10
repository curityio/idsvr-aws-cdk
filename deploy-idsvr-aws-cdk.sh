#!/bin/bash
set -eo pipefail
set -o allexport
source .env 
set +o allexport

display_help() {
  echo -e "Usage: $(basename "$0") [-h | --help] [-i | --install]  [-d | --delete]  \n" >&2
  echo "** DESCRIPTION **"
  echo -e "This script can be used to deploy Curity Identity Server in AWS using the AWS CDK.\n"
  echo -e "OPTIONS \n"
  echo " --help                         shows this help message and exit                                                                 "
  echo " --install                      deploys the Curity Identity Server in to the AWS using EC2 instances                             "
  echo " --delete                       deletes the Curity Identity Server and AWS resources                                             "
}

set_environment_variables(){
    if [[ -n "${REGION}" ]]; then    
      export AWS_DEFAULT_REGION=$REGION
    fi
    # set the default output to JSON, setting it here to avoid being hit by any misconfigurations in aws cli config
    export AWS_DEFAULT_OUTPUT="json"
}

generate_ec2_key_pair(){
  if [[ -z "${AWS_EC2_KEY_PAIR_NAME}" ]]; then
      ec2_key_pair_name="ec2-cdk-key-pair-$RANDOM"
      aws ec2 create-key-pair --key-name $ec2_key_pair_name --query 'KeyMaterial' --output text > "$ec2_key_pair_name".pem
      # set permissions
      chmod 400 "$ec2_key_pair_name".pem
      export AWS_EC2_KEY_PAIR_NAME=$ec2_key_pair_name
  fi
}

is_pki_already_available() {
  if [[ -f ./lib/alb/self-signed-certs/example.cdk.ssl.key && -f ./lib/alb/self-signed-certs/example.cdk.ssl.pem ]]; then
    true
  else
    false
  fi
}

generate_self_signed_certificates() {
  if ! is_pki_already_available; then
    bash ./lib/alb/self-signed-certs/create-self-signed-certs.sh
    echo -e "\n"
  fi
}

# Imports Self-signed certificates to AWS ACM so that they can be used in the LoadBalancer SSL configuration
import_certificate_to_aws_acm() {
  cert_arn=$(aws acm import-certificate --certificate fileb://lib/alb/self-signed-certs/example.cdk.ssl.pem --private-key fileb://lib/alb/self-signed-certs/example.cdk.ssl.key --certificate-chain fileb://lib/alb/self-signed-certs/example.cdk.ca.pem | jq -r '.CertificateArn')
  export AWS_ACM_SELF_SIGNED_CERT_ARN=$cert_arn
}

delete_acm_certificate() {
  aws_cert_arn=$(aws acm list-certificates | jq -r '.CertificateSummaryList[] | select(.DomainName=="*.example.cdk") | .CertificateArn')
  for cert in $aws_cert_arn; 
  do
    aws acm delete-certificate --certificate-arn "$cert" || true
  done
}

deploy_idsvr() {
  echo "Creating AWS resources and deploying the Curity Identity Server .."
  # create a new directory to store resolved userdata files
  mkdir -p ./lib/ec2/userdata
  cdk deploy

}

tear_down_environment() {
  cdk destroy
  delete_acm_certificate
}

# ==========
# entrypoint
# ==========

case $1 in
-i | --install)
  set_environment_variables
  generate_ec2_key_pair
  generate_self_signed_certificates
  import_certificate_to_aws_acm
  deploy_idsvr
  ;;
-d | --delete)
  set_environment_variables
  tear_down_environment
  ;;
-h | --help)
  display_help
  ;;
*)
  echo "[ERROR] Unsupported options"
  display_help
  exit 1
  ;;
esac
