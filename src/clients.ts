import { AutoScalingClient } from "@aws-sdk/client-auto-scaling";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import { S3Client } from "@aws-sdk/client-s3";
import { getCredentials } from "./inputs";

const awsConfig = {
  credentials: getCredentials(),
  region: process.env.INPUT_AWS_REGION || process.env.AWS_REGION,
};

export const asClient = new AutoScalingClient(awsConfig);
export const ebClient = new ElasticBeanstalkClient(awsConfig);
export const ec2Client = new EC2Client(awsConfig);
export const elbClient = new ElasticLoadBalancingV2Client(awsConfig);
export const s3Client = new S3Client(awsConfig);
