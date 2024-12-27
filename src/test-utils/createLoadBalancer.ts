import { DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import {
  CreateLoadBalancerCommand,
  CreateListenerCommand,
  CreateRuleCommand,
  waitUntilLoadBalancerAvailable,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { elbv2Client, ec2Client } from "../clients";
import { ActionInputs } from "../inputs";

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

  const alb = await elbv2Client
    .send(
      new CreateLoadBalancerCommand({
        Name: inputs.app_name.slice(0, 32),
        Subnets: defaultSubnets,
        Type: "application",
      })
    )
    .then(({ LoadBalancers }) => LoadBalancers[0]);

  const { Listeners } = await elbv2Client.send(
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
            MessageBody: alb.DNSName,
          },
        },
      ],
    })
  );

  const { Rules: prodRules } = await elbv2Client.send(
    new CreateRuleCommand({
      ListenerArn: Listeners[0].ListenerArn,
      Priority: 1,
      Conditions: [
        {
          Field: "host-header",
          Values: ["example.com"],
        },
      ],
      Actions: [
        {
          Type: "fixed-response",
          FixedResponseConfig: {
            StatusCode: "200",
            ContentType: "text/plain",
            MessageBody: "example.com",
          },
        },
      ],
      Tags: [
        {
          Key: "bluegreenbeanstalk:target_cname",
          Value: inputs.production_cname,
        },
      ],
    })
  );

  const { Rules: stagingRules } = await elbv2Client.send(
    new CreateRuleCommand({
      ListenerArn: Listeners[0].ListenerArn,
      Priority: 2,
      Conditions: [
        {
          Field: "host-header",
          Values: ["staging.example.com"],
        },
      ],
      Actions: [
        {
          Type: "fixed-response",
          FixedResponseConfig: {
            StatusCode: "200",
            ContentType: "text/plain",
            MessageBody: "staging.example.com",
          },
        },
      ],
      Tags: [
        { Key: "bluegreenbeanstalk:target_cname", Value: inputs.staging_cname },
      ],
    })
  );

  console.log(`Created load balancer ${alb.LoadBalancerArn}`);
  console.log(`Waiting for it to become available...`);

  await waitUntilLoadBalancerAvailable(
    { client: elbv2Client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { LoadBalancerArns: [alb.LoadBalancerArn] }
  );

  return {
    alb,
    defaultListener: Listeners[0],
    prodRule: prodRules[0],
    stagingRule: stagingRules[0],
  };
}
