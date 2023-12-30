import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import {
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  Action,
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  DescribeTargetGroupsCommand,
  Listener,
  ModifyRuleCommand,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { asClient, ebClient, elbv2Client } from "./clients";
import { ActionInputs } from "./inputs";
import { getEnvironments } from "./getEnvironments";

export async function removeTargetGroups(inputs: ActionInputs) {
  const rules = await getRules(inputs);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  const handleActions = (actions: Action[]) => {
    const idx = actions.length - 1;
    actions[idx] = {
      Type: "fixed-response",
      FixedResponseConfig: {
        ContentType: "text/plain",
        MessageBody: "Environment not available",
        StatusCode: "404",
      },
    };
    return actions;
  };

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules[ResourceArn];
    for (const { Key, Value } of Tags) {
      if (Key === "bluegreenbeanstalk:cname" && Value === inputs.stagingCNAME) {
        await elbv2Client.send(
          new ModifyRuleCommand({
            RuleArn: ResourceArn,
            Actions: handleActions(rule.Actions),
          })
        );
        console.log(`Updated ${ResourceArn}`);
      }
    }
  }
}

export async function updateTargetGroups(inputs: ActionInputs) {
  const rules = await getRules(inputs);
  const targetGroupARNsByPortByCname = await findTargetGroupArns(inputs);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  const handleActions = (actions: Action[], targetGroupArn) => {
    const idx = actions.length - 1;
    actions[idx] = {
      Type: "forward",
      TargetGroupArn: targetGroupArn,
    };
    return actions;
  };

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules[ResourceArn];
    for (const { Key, Value: CNAME } of Tags) {
      if (Key === "bluegreenbeanstalk:cname") {
        const targetGroupArn = targetGroupARNsByPortByCname[CNAME][rule.port];
        if (targetGroupArn) {
          await elbv2Client.send(
            new ModifyRuleCommand({
              RuleArn: ResourceArn,
              Actions: handleActions(rule.Actions, targetGroupArn),
            })
          );
          console.log(`Updated ${ResourceArn}`);
        } else {
          console.warn(`No target group found for ${CNAME}`);
        }
      }
    }
  }
}

async function findTargetGroupArns(inputs: ActionInputs) {
  const { prodEnv, stagingEnv } = await getEnvironments(inputs);
  interface TargetGroupARNsByPortByCname {
    [cname: string]: { [port: number]: string };
  }

  const getCnamePrefix = (env: EnvironmentDescription) => {
    const prefix = env.CNAME.split(
      `.${inputs.awsRegion}.elasticbeanstalk.com`
    )[0];
    if (![inputs.productionCNAME, inputs.stagingCNAME].includes(prefix)) {
      throw new Error(`Unexpected CNAME: ${prefix}`);
    }
    return prefix;
  };

  const targetGroupARNsByPortByCname: TargetGroupARNsByPortByCname = {
    [getCnamePrefix(prodEnv)]: {},
    [getCnamePrefix(stagingEnv)]: {},
  };

  const getTargetGroupArns = async (env: EnvironmentDescription) => {
    const { EnvironmentResources } = await ebClient.send(
      new DescribeEnvironmentResourcesCommand({
        EnvironmentName: env.EnvironmentName,
      })
    );

    const { AutoScalingGroups } = await asClient.send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: EnvironmentResources.AutoScalingGroups.map(
          ({ Name }) => Name
        ),
      })
    );

    const targetGroupARNs = new Set<string>();
    for (const { TargetGroupARNs } of AutoScalingGroups) {
      for (const arn of TargetGroupARNs) {
        targetGroupARNs.add(arn);
      }
    }

    const CNAME = getCnamePrefix(env);
    await elbv2Client
      .send(
        new DescribeTargetGroupsCommand({
          TargetGroupArns: Array.from(targetGroupARNs),
        })
      )
      .then(({ TargetGroups }) => {
        for (const { TargetGroupArn, Port } of TargetGroups) {
          if (targetGroupARNsByPortByCname[CNAME][Port]) {
            console.warn(`Duplicate target group for port ${Port} on ${CNAME}`);
          }
          targetGroupARNsByPortByCname[CNAME][Port] = TargetGroupArn;
        }
      });
  };

  await Promise.all([
    getTargetGroupArns(prodEnv),
    getTargetGroupArns(stagingEnv),
  ]);

  return targetGroupARNsByPortByCname;
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
        for (const { Name } of EnvironmentResources.LoadBalancers) {
          loadBalancerArns.add(Name);
        }
      });

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

  interface RuleWithPort extends Rule {
    port: number;
  }

  const rules: RuleWithPort[] = [];
  for (const { ListenerArn, Port } of listeners) {
    await elbv2Client
      .send(new DescribeRulesCommand({ ListenerArn: ListenerArn }))
      .then(({ Rules }) => {
        for (const rule of Rules) {
          (rule as RuleWithPort).port = Port;
          rules.push(rule as RuleWithPort);
        }
      });
  }

  interface RulesByArn {
    [arn: string]: RuleWithPort;
  }
  const rulesByArn: RulesByArn = {};
  for (const rule of rules) {
    rulesByArn[rule.RuleArn] = rule;
  }

  return rulesByArn;
}
