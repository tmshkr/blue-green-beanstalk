import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
} from "@aws-sdk/client-auto-scaling";
import {
  DescribeListenersCommand,
  ElasticLoadBalancingV2Client,
  ModifyListenerCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  DescribeEnvironmentResourcesCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs, getCredentials } from "./inputs";

export async function updateListener(
  ebClient: ElasticBeanstalkClient,
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription
) {
  const config = {
    credentials: getCredentials(),
    region: inputs.awsRegion,
  };
  const asClient = new AutoScalingClient(config);
  const elbClient = new ElasticLoadBalancingV2Client(config);

  const { EnvironmentResources } = await ebClient.send(
    new DescribeEnvironmentResourcesCommand({
      EnvironmentId: targetEnv.EnvironmentId,
    })
  );

  const { AutoScalingGroups } = await asClient.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [EnvironmentResources.AutoScalingGroups[0].Name],
    })
  );

  const { Listeners } = await elbClient.send(
    new DescribeListenersCommand({
      LoadBalancerArn: EnvironmentResources.LoadBalancers[0].Name,
    })
  );

  await elbClient.send(
    new ModifyListenerCommand({
      ListenerArn: Listeners.find(({ Port }) => Port === 80).ListenerArn,
      DefaultActions: [
        {
          Type: "forward",
          TargetGroupArn: AutoScalingGroups[0].TargetGroupARNs[0],
        },
      ],
    })
  );

  console.log("Updated ALB listener's default rule");
}
