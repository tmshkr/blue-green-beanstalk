import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import {
  DescribeListenersCommand,
  ModifyListenerCommand,
  DescribeTargetGroupsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import {
  DescribeEnvironmentsCommand,
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { asClient, ebClient, elbClient } from "./clients";
import { ActionInputs } from "./inputs";

export async function updateListener(
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription
) {
  const ports = new Set(inputs.ports);
  const { EnvironmentResources } = await ebClient.send(
    new DescribeEnvironmentResourcesCommand({
      EnvironmentId: targetEnv.EnvironmentId,
    })
  );
  const { TargetGroupARNs } = await asClient
    .send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: [EnvironmentResources.AutoScalingGroups[0].Name],
      })
    )
    .then(({ AutoScalingGroups }) => AutoScalingGroups[0]);

  if (TargetGroupARNs.length === 0) {
    throw new Error("No target groups found in AutoScalingGroup");
  } else if (TargetGroupARNs.length === 1) {
    var targetGroupArn = TargetGroupARNs[0];
  } else {
    var mapPortToTargetGroup: {
      [x: number]: string;
    } = await elbClient
      .send(
        new DescribeTargetGroupsCommand({
          TargetGroupArns: TargetGroupARNs,
        })
      )
      .then(({ TargetGroups }) => {
        const map = {};
        for (const { Port, TargetGroupArn } of TargetGroups) {
          if (ports.has(Port)) {
            map[Port] = TargetGroupArn;
          }
        }
        return map;
      });
  }

  const { Listeners } = await elbClient.send(
    new DescribeListenersCommand({
      LoadBalancerArn: EnvironmentResources.LoadBalancers[0].Name,
    })
  );

  await Promise.all(
    Listeners.map(({ Port, ListenerArn }) => {
      if (ports.has(Port)) {
        return elbClient.send(
          new ModifyListenerCommand({
            ListenerArn: ListenerArn,
            DefaultActions: [
              {
                Type: "forward",
                TargetGroupArn:
                  targetGroupArn ||
                  mapPortToTargetGroup[Port] ||
                  mapPortToTargetGroup[inputs.ports[0]],
              },
            ],
          })
        );
      }
    })
  );

  console.log("Updated ALB listener's default rule");
}
