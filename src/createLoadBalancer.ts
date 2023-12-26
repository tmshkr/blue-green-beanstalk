import { DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import {
  CreateLoadBalancerCommand,
  waitUntilLoadBalancerAvailable,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { elbClient, ec2Client } from "./clients";
import { ActionInputs } from "./inputs";

export async function createLoadBalancer(inputs: ActionInputs) {
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

  console.log(`Created load balancer ${alb.LoadBalancerArn}`);
  console.log(`Waiting for it to become available...`);

  await waitUntilLoadBalancerAvailable(
    { client: elbClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { LoadBalancerArns: [alb.LoadBalancerArn] }
  );

  return alb;
}
