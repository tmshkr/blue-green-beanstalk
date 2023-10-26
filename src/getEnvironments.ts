import {
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  DescribeTagsCommand,
  DescribeListenersCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ActionInputs, DeploymentStrategy } from "./inputs";
import { ebClient, elbClient } from "./clients";

export async function getEnvironments(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs
): Promise<{
  prodEnv: EnvironmentDescription | undefined;
  stagingEnv: EnvironmentDescription | undefined;
}> {
  const { Environments } = await client.send(
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
      const prodEnvName = await findSharedALBProdEnvName(inputs, Environments);
      return {
        prodEnv: Environments.find(
          ({ EnvironmentName }) => EnvironmentName === prodEnvName
        ),
        stagingEnv: Environments.find(
          ({ EnvironmentName }) => EnvironmentName !== prodEnvName
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

async function findSharedALBProdEnvName(
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

  // get the tags for the default target group, which will have the name of the prodEnv
  const defaultListener = await elbClient
    .send(
      new DescribeListenersCommand({
        LoadBalancerArn: loadBalancers[0],
      })
    )
    .then(({ Listeners }) => Listeners.find(({ Port }) => Port === 80));

  const prodTGArn = defaultListener.DefaultActions[0].TargetGroupArn;
  if (!prodTGArn) {
    throw new Error("No default target group found");
  }

  const prodEnvName = await elbClient
    .send(
      new DescribeTagsCommand({
        ResourceArns: [prodTGArn],
      })
    )
    .then(({ TagDescriptions }) => {
      return TagDescriptions[0].Tags.find(
        ({ Key, Value }) =>
          Key === "elasticbeanstalk:environment-name" &&
          [inputs.blueEnv, inputs.greenEnv].includes(Value)
      ).Value;
    });

  if (!prodEnvName) {
    throw new Error(
      "Neither the blue or green environment is associated with the default target group"
    );
  }

  return prodEnvName;
}
