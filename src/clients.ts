import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { S3Client } from "@aws-sdk/client-s3";
import { SSMClient } from "@aws-sdk/client-ssm";

function getCredentials() {
  const credentials = {
    accessKeyId:
      process.env.INPUT_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.INPUT_AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken:
      process.env.INPUT_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
  };
  return (credentials.accessKeyId && credentials.secretAccessKey) ||
    credentials.sessionToken
    ? credentials
    : undefined;
}

const awsConfig = {
  credentials: getCredentials(),
  region:
    process.env.INPUT_AWS_REGION ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION,
};

export const asClient = new AutoScalingClient(awsConfig);
export const cfnClient = new CloudFormationClient(awsConfig);
export const ebClient = new ElasticBeanstalkClient(awsConfig);
export const ec2Client = new EC2Client(awsConfig);
export const elbv2Client = new ElasticLoadBalancingV2Client(awsConfig);
export const s3Client = new S3Client(awsConfig);
export const ssmClient = new SSMClient(awsConfig);
