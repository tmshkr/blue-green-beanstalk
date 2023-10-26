import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import {
  DescribeListenersCommand,
  ModifyListenerCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { asClient, ebClient, elbClient } from "./clients";

export async function updateListener(targetEnv: EnvironmentDescription) {
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
