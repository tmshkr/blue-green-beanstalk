import { DescribeEnvironmentResourcesCommand } from "@aws-sdk/client-elastic-beanstalk";
import {
  Action,
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  Listener,
  ModifyRuleCommand,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ebClient, elbv2Client } from "./clients";
import { ActionInputs } from "./inputs";

export async function removeTargetGroups(inputs: ActionInputs) {
  const rules = await getRules(inputs);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  for (const { Tags, ResourceArn } of TagDescriptions) {
    for (const { Key, Value } of Tags) {
      if (Key === "elasticbeanstalk:cname") {
        if (Value == inputs.stagingCNAME) {
          await elbv2Client.send(
            new ModifyRuleCommand({
              RuleArn: ResourceArn,
              Actions: [
                {
                  Type: "fixed-response",
                  FixedResponseConfig: {
                    ContentType: "text/plain",
                    MessageBody: "Environment not available",
                    StatusCode: "404",
                  },
                },
              ],
            })
          );
          console.log(`Updated ${ResourceArn}`);
        }
      }
    }
  }
}

export async function updateTargetGroups(inputs: ActionInputs) {
  const rules = await getRules(inputs);
  const { prodTgArn, stagingTgArn } = findTargetGroupArns(
    inputs,
    Object.values(rules)
  );

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  const handleActions = (actions: Action[], tgArn) => {
    const idx = actions.length - 1;
    actions[idx] = {
      Type: "forward",
      TargetGroupArn: tgArn,
    };
    return actions;
  };

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules[ResourceArn];
    for (const { Key, Value } of Tags) {
      if (Key === "elasticbeanstalk:cname") {
        switch (Value) {
          case inputs.productionCNAME:
            if (prodTgArn) {
              await elbv2Client.send(
                new ModifyRuleCommand({
                  RuleArn: ResourceArn,
                  Actions: handleActions(rule.Actions, prodTgArn),
                })
              );
              console.log(`Updated ${ResourceArn}`);
            }
            break;
          case inputs.stagingCNAME:
            if (stagingTgArn) {
              await elbv2Client.send(
                new ModifyRuleCommand({
                  RuleArn: ResourceArn,
                  Actions: handleActions(rule.Actions, stagingTgArn),
                })
              );
              console.log(`Updated ${ResourceArn}`);
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

async function getRules(inputs: ActionInputs) {
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

  interface RulesByArn {
    [key: string]: Rule;
  }
  const rulesByArn: RulesByArn = {};
  rules.reduce((acc, rule) => {
    acc[rule.RuleArn] = rule;
    return acc;
  }, rulesByArn);

  return rulesByArn;
}
