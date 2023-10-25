import { EC2Client, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import {
  ElasticLoadBalancingV2Client,
  CreateLoadBalancerCommand,
  CreateListenerCommand,
  waitUntilLoadBalancerAvailable,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ActionInputs, getCredentials } from "./inputs";

export async function createLoadBalancer(inputs: ActionInputs) {
  const elbClient = new ElasticLoadBalancingV2Client({
    credentials: getCredentials(),
    region: inputs.awsRegion,
  });
  const ec2Client = new EC2Client({
    credentials: getCredentials(),
    region: inputs.awsRegion,
  });

  const defaultSubnets = await ec2Client
    .send(
      new DescribeSubnetsCommand({
        Filters: [
          {
            Name: "default-for-az",
            Values: ["true"],
          },
        ],
      })
    )
    .then(({ Subnets }) => Subnets.map(({ SubnetId }) => SubnetId));

  if (!defaultSubnets.length) {
    throw new Error("Cannot create load balancer. No default subnets found.");
  }

  const alb = await elbClient
    .send(
      new CreateLoadBalancerCommand({
        Name: inputs.appName.slice(0, 32),
        Subnets: defaultSubnets,
      })
    )
    .then(({ LoadBalancers }) => LoadBalancers[0]);

  await elbClient.send(
    new CreateListenerCommand({
      LoadBalancerArn: alb.LoadBalancerArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [
        {
          Type: "fixed-response",
          FixedResponseConfig: {
            StatusCode: "200",
            ContentType: "text/plain",
            MessageBody: "OK",
          },
        },
      ],
    })
  );

  console.log(`Created load balancer ${alb.LoadBalancerArn}`);
  console.log(`Waiting for it to become available...`);

  await waitUntilLoadBalancerAvailable(
    { client: elbClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { LoadBalancerArns: [alb.LoadBalancerArn] }
  );

  return alb;
}
