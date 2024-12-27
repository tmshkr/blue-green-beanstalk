import { DescribeAutoScalingGroupsCommand } from "@aws-sdk/client-auto-scaling";
import {
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
  EnvironmentResourceDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeTagsCommand,
  DescribeTargetGroupsCommand,
  ModifyRuleCommand,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { asClient, ebClient, elbv2Client } from "./clients";
import { ActionInputs, mapHealthColorToInt } from "./inputs";
import { getEnvironments } from "./getEnvironments";

export async function removeTargetGroups(inputs: ActionInputs) {
  const { stagingEnv } = await getEnvironments(inputs);
  if (!stagingEnv) {
    console.warn("Staging environment not found");
    return;
  }
  const resources = await getEnvironmentResources([stagingEnv]);
  const rules = await getRules(resources);

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Array.from(rules.keys()),
    })
  );

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules.get(ResourceArn);
    if (!rule) throw new Error(`No rule found for: ${ResourceArn}`);
    for (const { Key, Value } of Tags) {
      if (
        Key === "bluegreenbeanstalk:target_cname" &&
        Value === inputs.staging_cname
      ) {
        const { Actions, RuleArn } = rule;
        Actions[Actions.length - 1] = {
          Type: "fixed-response",
          FixedResponseConfig: {
            ContentType: "text/plain",
            MessageBody: "Environment not available",
            StatusCode: "503",
          },
        };
        await elbv2Client.send(new ModifyRuleCommand({ RuleArn, Actions }));
        console.log(`Updated rule:`, rule.RuleArn);
      }
    }
  }
}

export async function updateTargetGroups(inputs: ActionInputs) {
  console.log("Updating listener rules...");
  const { prodEnv, stagingEnv, singleEnv } = await getEnvironments(inputs);
  const environments = [prodEnv, stagingEnv, singleEnv].filter((env) => {
    if (!env) return false;
    if (
      inputs.update_listener_rules_cname !== "true" &&
      inputs.update_listener_rules_cname !== getCnamePrefix(inputs, env)
    ) {
      return false;
    }

    if (env.Status !== "Ready") {
      console.log(`[${env.EnvironmentName}]: Status is ${env.Status}`);
      console.log(`[${env.EnvironmentName}]: Skipping...`);
      return false;
    }

    if (mapHealthColorToInt(env.Health) < inputs.minimum_health_color) {
      console.warn(`[${env.EnvironmentName}]: Health is ${env.Health}`);
      console.log(`[${env.EnvironmentName}]: Skipping...`);
      return false;
    }

    return true;
  });

  if (environments.length === 0) {
    console.warn("No environments available for updating listener rules");
    return;
  }

  const resources = await getEnvironmentResources(environments);
  const rules = await getRules(resources);
  if (rules.size === 0) {
    console.warn("No rules found");
    return;
  }
  const targetGroupARNs = await findTargetGroupArns(
    inputs,
    environments,
    resources
  );
  if (targetGroupARNs.size === 0) {
    console.warn("No target groups found");
    return;
  }

  const { TagDescriptions } = await elbv2Client.send(
    new DescribeTagsCommand({
      ResourceArns: Array.from(rules.keys()),
    })
  );

  for (const { Tags, ResourceArn } of TagDescriptions) {
    const rule = rules.get(ResourceArn);
    if (!rule) throw new Error(`No rule found for: ${ResourceArn}`);
    const cname = Tags.find(
      ({ Key }) => Key === "bluegreenbeanstalk:target_cname"
    )?.Value;

    if (!cname) continue;

    const port =
      Tags.find(({ Key }) => Key === "bluegreenbeanstalk:target_port")?.Value ||
      80;

    const targetGroupArn = targetGroupARNs.get(`${cname}:${port}`);
    if (targetGroupArn) {
      const { Actions, RuleArn } = rule;
      Actions[Actions.length - 1] = {
        Type: "forward",
        ForwardConfig: {
          TargetGroups: [
            {
              TargetGroupArn: targetGroupArn,
              Weight: 1,
            },
          ],
          TargetGroupStickinessConfig: { Enabled: false },
        },
      };
      await elbv2Client.send(new ModifyRuleCommand({ RuleArn, Actions }));
      console.log(`Updated rule:`);
      console.log(
        `https://${inputs.aws_region}.console.aws.amazon.com/ec2/home?region=${inputs.aws_region}#ListenerRuleDetails:ruleArn=${rule.RuleArn}`
      );
    }
  }
}

function getCnamePrefix(inputs: ActionInputs, env: EnvironmentDescription) {
  const prefix = env.CNAME.split(
    `.${inputs.aws_region}.elasticbeanstalk.com`
  )[0];
  if (!prefix) {
    throw new Error(`No prefix found for: ${env.CNAME}`);
  }
  return prefix;
}

async function findTargetGroupArns(
  inputs: ActionInputs,
  environments: EnvironmentDescription[],
  resources: EnvironmentResourceDescription[]
) {
  const mapEnvironmentIdToCname = new Map<string, string>();
  for (const env of environments) {
    mapEnvironmentIdToCname.set(env.EnvironmentId, getCnamePrefix(inputs, env));
  }

  const { AutoScalingGroups } = await asClient.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: resources.flatMap(({ AutoScalingGroups }) =>
        AutoScalingGroups.map(({ Name }) => Name)
      ),
    })
  );

  /* (Target Group ARN => EB Environment ID) */
  const mapTargetGroupArnToEnvironmentId = new Map<string, string>();
  for (const { Tags, TargetGroupARNs } of AutoScalingGroups) {
    for (const { Key, Value } of Tags) {
      if (Key === "elasticbeanstalk:environment-id") {
        for (const arn of TargetGroupARNs) {
          mapTargetGroupArnToEnvironmentId.set(arn, Value);
        }
      }
    }
  }

  const { TargetGroups } = await elbv2Client.send(
    new DescribeTargetGroupsCommand({
      TargetGroupArns: AutoScalingGroups.flatMap(
        ({ TargetGroupARNs }) => TargetGroupARNs
      ),
    })
  );

  /* (CNAME:PORT => Target Group ARN) */
  const targetGroupsByCname = new Map<string, string>();
  for (const { Port, TargetGroupArn } of TargetGroups) {
    const envId = mapTargetGroupArnToEnvironmentId.get(TargetGroupArn);
    if (!envId)
      throw new Error(
        `No environment found for Target Group: ${TargetGroupArn}`
      );

    const cname = mapEnvironmentIdToCname.get(envId);
    if (cname) {
      targetGroupsByCname.set(`${cname}:${Port}`, TargetGroupArn);
    }
  }

  return targetGroupsByCname;
}

async function getEnvironmentResources(environments: EnvironmentDescription[]) {
  if (environments.length === 0) {
    throw new Error("No environments provided");
  }

  const resources = await Promise.all(
    environments.map((env) =>
      ebClient
        .send(
          new DescribeEnvironmentResourcesCommand({
            EnvironmentId: env.EnvironmentId,
          })
        )
        .then(({ EnvironmentResources }) => {
          return EnvironmentResources;
        })
    )
  );

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

  const rules = new Map<string, Rule>();
  for (const { ListenerArn } of Listeners) {
    await elbv2Client
      .send(new DescribeRulesCommand({ ListenerArn }))
      .then(({ Rules }) => {
        for (const rule of Rules) {
          rules.set(rule.RuleArn, rule);
        }
      });
  }

  return rules;
}
