import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import {
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
  EnvironmentResourceDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  Action,
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  DescribeTargetGroupsCommand,
  ModifyRuleCommand,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { asClient, ebClient, elbv2Client } from "./clients";
import { ActionInputs } from "./inputs";
import { getEnvironments } from "./getEnvironments";

interface TargetGroupARNsByPortByCname {
  [cname: string]: { [port: number]: string };
}

interface RulesByArn {
  [arn: string]: Rule;
}

export async function removeTargetGroups(inputs: ActionInputs) {
  const { prodEnv, stagingEnv } = await getEnvironments(inputs);
  const environments = [prodEnv, stagingEnv].filter((env) => !!env);
  const resources = await getEnvironmentResources(environments);
  const rules = await getRules(resources);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  const handleActions = (actions: Action[]) => {
    actions[actions.length - 1] = {
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
      if (
        Key === "bluegreenbeanstalk:target_cname" &&
        Value === inputs.stagingCNAME
      ) {
        await elbv2Client.send(
          new ModifyRuleCommand({
            RuleArn: ResourceArn,
            Actions: handleActions(rule.Actions),
          })
        );
        console.log(
          `Set ${inputs.stagingCNAME} fixed-response rule: ${ResourceArn}`
        );
      }
    }
  }
}

export async function updateTargetGroups(inputs: ActionInputs) {
  const { prodEnv, stagingEnv } = await getEnvironments(inputs);
  const environments = [prodEnv, stagingEnv].filter(
    (env) => env?.Status === "Ready" && env?.Health === "Green"
  );
  const resources = await getEnvironmentResources(environments);
  const rules = await getRules(resources);
  const targetGroupARNs = await findTargetGroupArns(
    inputs,
    environments,
    resources
  );

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Object.keys(rules),
    })
  );

  const handleActions = (actions: Action[], targetGroupArn) => {
    actions[actions.length - 1] = {
      Type: "forward",
      TargetGroupArn: targetGroupArn,
    };
    return actions;
  };

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules[ResourceArn];
    const cname = Tags.find(
      ({ Key }) => Key === "bluegreenbeanstalk:target_cname"
    )?.Value;

    if (![inputs.stagingCNAME, inputs.productionCNAME].includes(cname))
      continue;

    const port =
      Tags.find(({ Key }) => Key === "bluegreenbeanstalk:target_port")?.Value ||
      80;

    const targetGroupArn = targetGroupARNs[cname]?.[port];
    if (targetGroupArn) {
      await elbv2Client.send(
        new ModifyRuleCommand({
          RuleArn: ResourceArn,
          Actions: handleActions(rule.Actions, targetGroupArn),
        })
      );
      console.log(`${cname} -> ${targetGroupArn.split("/")[1]}:${port}`);
    } else {
      console.warn(`No target group found for ${cname} on ${ResourceArn}`);
    }
  }
}

function getCnamePrefix(inputs: ActionInputs, env: EnvironmentDescription) {
  const prefix = env.CNAME.split(
    `.${inputs.awsRegion}.elasticbeanstalk.com`
  )[0];
  if (![inputs.productionCNAME, inputs.stagingCNAME].includes(prefix)) {
    throw new Error(`Unexpected CNAME: ${prefix}`);
  }
  return prefix;
}

async function findTargetGroupArns(
  inputs: ActionInputs,
  environments: EnvironmentDescription[],
  resources: EnvironmentResourceDescription[]
) {
  const result: TargetGroupARNsByPortByCname = {};
  for (const env of environments) {
    const prefix = getCnamePrefix(inputs, env);
    result[prefix] = {};
  }

  const get = async (
    inputs: ActionInputs,
    env: EnvironmentDescription,
    resourceDescription: EnvironmentResourceDescription
  ) => {
    const { AutoScalingGroups } = await asClient.send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: resourceDescription.AutoScalingGroups.map(
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

    const CNAME = getCnamePrefix(inputs, env);
    await elbv2Client
      .send(
        new DescribeTargetGroupsCommand({
          TargetGroupArns: Array.from(targetGroupARNs),
        })
      )
      .then(({ TargetGroups }) => {
        for (const { Port, TargetGroupArn } of TargetGroups) {
          result[CNAME][Port] = TargetGroupArn;
        }
      });
  };

  await Promise.all(
    resources.map((resourceDescription) =>
      get(
        inputs,
        environments.find(
          (env) => env.EnvironmentName === resourceDescription.EnvironmentName
        ),
        resourceDescription
      )
    )
  );

  return result;
}

async function getEnvironmentResources(environments: EnvironmentDescription[]) {
  if (environments.length === 0) {
    throw new Error("No environments provided");
  }

  const resources: EnvironmentResourceDescription[] = [];
  const get = async (env: EnvironmentDescription) => {
    await ebClient
      .send(
        new DescribeEnvironmentResourcesCommand({
          EnvironmentId: env.EnvironmentId,
        })
      )
      .then(({ EnvironmentResources }) => {
        resources.push(EnvironmentResources);
      });
  };

  await Promise.all(environments.map((env) => get(env)));

  if (resources.length === 0) {
    throw new Error("No resources found");
  }

  if (resources.length !== environments.length) {
    throw new Error(
      `Expected ${environments.length} resources, got ${resources.length}`
    );
  }
  return resources;
}

async function getRules(resources: EnvironmentResourceDescription[]) {
  const loadBalancerArns = new Set<string>();
  for (const { LoadBalancers } of resources) {
    for (const { Name } of LoadBalancers) {
      loadBalancerArns.add(Name);
    }
  }

  if (loadBalancerArns.size === 0) {
    throw new Error("No load balancers found");
  }
  if (loadBalancerArns.size > 1) {
    throw new Error("Environments must use the same load balancer");
  }

  const { Listeners } = await elbv2Client.send(
    new DescribeListenersCommand({
      LoadBalancerArn: Array.from(loadBalancerArns)[0],
    })
  );

  const rules: Rule[] = [];
  for (const { ListenerArn } of Listeners) {
    await elbv2Client
      .send(new DescribeRulesCommand({ ListenerArn: ListenerArn }))
      .then(({ Rules }) => {
        for (const rule of Rules) {
          rules.push(rule);
        }
      });
  }

  const rulesByArn: RulesByArn = {};
  for (const rule of rules) {
    rulesByArn[rule.RuleArn] = rule;
  }

  return rulesByArn;
}
