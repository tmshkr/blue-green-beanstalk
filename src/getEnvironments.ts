import {
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  DescribeTagsCommand,
  DescribeListenersCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ActionInputs, DeploymentStrategy } from "./inputs";
import { ebClient, elbClient } from "./clients";

export async function getEnvironments(inputs: ActionInputs): Promise<{
  prodEnv: EnvironmentDescription | undefined;
  stagingEnv: EnvironmentDescription | undefined;
}> {
  const { Environments } = await ebClient.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: inputs.appName,
      EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
      IncludeDeleted: false,
    })
  );

  if (Environments.length === 0) {
    return {
      prodEnv: undefined,
      stagingEnv: undefined,
    };
  }

  switch (inputs.strategy) {
    case DeploymentStrategy.SharedALB:
      const prodEnvId = await findSharedALBProdEnvId(inputs, Environments);
      return {
        prodEnv: Environments.find(
          ({ EnvironmentId }) => EnvironmentId === prodEnvId
        ),
        stagingEnv: Environments.find(
          ({ EnvironmentId }) => EnvironmentId !== prodEnvId
        ),
      };

    case DeploymentStrategy.SwapCNAMEs:
      const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
      return {
        prodEnv: Environments.find(({ CNAME }) => CNAME === prodDomain),
        stagingEnv: Environments.find(({ CNAME }) => CNAME !== prodDomain),
      };

    default:
      throw new Error(`Unknown strategy: ${inputs.strategy}`);
  }
}

async function findSharedALBProdEnvId(
  inputs: ActionInputs,
  environments: EnvironmentDescription[]
) {
  const resources = await Promise.all(
    environments.map((env) => {
      return ebClient
        .send(
          new DescribeEnvironmentResourcesCommand({
            EnvironmentId: env.EnvironmentId,
          })
        )
        .then(({ EnvironmentResources }) => EnvironmentResources);
    })
  );

  const loadBalancers = resources.map(
    ({ LoadBalancers }) => LoadBalancers[0]?.Name
  );

  // check that it is a valid shared alb
  for (const arn of loadBalancers) {
    if (!arn) {
      throw new Error(
        "All environments must be associated a with a load balancer"
      );
    }
    if (/:loadbalancer\/[^app]/.test(arn)) {
      throw new Error("Only Application Load Balancers are supported");
    }
    if (/:loadbalancer\/app\/awseb/.test(arn)) {
      throw new Error(
        "Dedicated load balancers created by Elastic Beanstalk are not supported"
      );
    }
  }

  if (new Set(loadBalancers).size !== 1) {
    throw new Error("All environments must share the same load balancer");
  }

  // get the tags for the default target group, which will have the id of the prodEnv
  const tgARNs = await elbClient
    .send(
      new DescribeListenersCommand({
        LoadBalancerArn: loadBalancers[0],
      })
    )
    .then(({ Listeners }) =>
      Listeners.filter(({ Port }) => inputs.ports.includes(Port))
        .map(({ DefaultActions }) =>
          DefaultActions.map(({ TargetGroupArn }) => TargetGroupArn)
        )
        .flat(1)
        .filter(Boolean)
    );

  if (!tgARNs.length) {
    throw new Error("No default target group found");
  }

  const prodEnvId = await elbClient
    .send(
      new DescribeTagsCommand({
        ResourceArns: tgARNs,
      })
    )
    .then(({ TagDescriptions }) => {
      const ids = [];
      for (const { Tags } of TagDescriptions) {
        for (const { Key, Value } of Tags) {
          if (Key === "elasticbeanstalk:environment-id") {
            ids.push(Value);
          }
        }
      }
      if (new Set(ids).size > 1) {
        throw new Error(
          "Multiple environments are associated with the specified ports"
        );
      }
      return ids[0];
    });

  if (!prodEnvId) {
    throw new Error(
      "Neither the blue or green environment is associated with the default target group"
    );
  }

  return prodEnvId;
}
