import { DescribeEnvironmentResourcesCommand } from "@aws-sdk/client-elastic-beanstalk";
import {
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  Listener,
  ModifyRuleCommand,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ebClient, elbv2Client } from "./clients";
import { ActionInputs } from "./inputs";

export async function removeTargetGroups() {}

export async function updateTargetGroups(inputs: ActionInputs) {
  const loadBalancerArns = await getLoadBalancers(inputs);
  const listeners: Listener[] = [];
  for (const loadBalancerArn of loadBalancerArns) {
    await elbv2Client
      .send(
        new DescribeListenersCommand({
          LoadBalancerArn: loadBalancerArn,
        })
      )
      .then(({ Listeners }) => listeners.push(...Listeners));
  }
  const rules: Rule[] = [];
  for (const listener of listeners) {
    await elbv2Client
      .send(new DescribeRulesCommand({ ListenerArn: listener.ListenerArn }))
      .then(({ Rules }) => rules.push(...Rules));
  }

  const { prodTgArn, stagingTgArn } = findTargetGroupArns(inputs, rules);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: rules.map((rule) => rule.RuleArn),
    })
  );

  for (const { Tags, ResourceArn } of TagDescriptions) {
    for (const tag of Tags) {
      if (tag.Key === "elasticbeanstalk:cname") {
        switch (tag.Value) {
          case inputs.productionCNAME:
            if (prodTgArn) {
              await elbv2Client.send(
                new ModifyRuleCommand({
                  RuleArn: ResourceArn,
                  Actions: [
                    {
                      Type: "forward",
                      TargetGroupArn: prodTgArn,
                    },
                  ],
                })
              );
            }
            break;
          case inputs.stagingCNAME:
            if (stagingTgArn) {
              await elbv2Client.send(
                new ModifyRuleCommand({
                  RuleArn: ResourceArn,
                  Actions: [
                    {
                      Type: "forward",
                      TargetGroupArn: stagingTgArn,
                    },
                  ],
                })
              );
            }
            break;

          default:
            break;
        }
      }
    }
  }
}

function findTargetGroupArns(inputs: ActionInputs, rules: Rule[]) {
  let prodTgArn: string | undefined;
  let stagingTgArn: string | undefined;

  for (const { Actions, Conditions } of rules) {
    for (const { Field, Values } of Conditions) {
      if (Field?.includes("host-header")) {
        if (
          Values?.includes(
            `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
          )
        ) {
          prodTgArn = Actions?.find(
            (action) => action.Type === "forward"
          ).TargetGroupArn;
        } else if (
          Values?.includes(
            `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
          )
        ) {
          stagingTgArn = Actions?.find(
            (action) => action.Type === "forward"
          ).TargetGroupArn;
        }
      }
    }
    if (prodTgArn && stagingTgArn) break;
  }

  return { prodTgArn, stagingTgArn };
}

async function getLoadBalancers(inputs: ActionInputs) {
  const loadBalancerArns = new Set<string>();
  const getLoadBalancer = (envName: string) =>
    ebClient
      .send(
        new DescribeEnvironmentResourcesCommand({
          EnvironmentName: envName,
        })
      )
      .then(({ EnvironmentResources }) => {
        loadBalancerArns.add(EnvironmentResources.LoadBalancers[0].Name);
      })
      .catch(console.log);

  await Promise.all([
    getLoadBalancer(inputs.blueEnv),
    getLoadBalancer(inputs.greenEnv),
  ]);
  return Array.from(loadBalancerArns);
}
