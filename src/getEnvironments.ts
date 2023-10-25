import {
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs, DeploymentStrategy } from "./inputs";

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
      // check that it is a valid shared alb
      const loadBalancers = await Promise.all(
        Environments.map((env) => {
          return client
            .send(
              new DescribeEnvironmentResourcesCommand({
                EnvironmentId: env.EnvironmentId,
              })
            )
            .then((res) => res.EnvironmentResources.LoadBalancers[0]?.Name);
        })
      );

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

      const numLoadBalancers = new Set(loadBalancers).size;
      if (numLoadBalancers !== 1) {
        throw new Error("All environments must share the same load balancer");
      }

      // get the tags for the default target group, which will have the id of the prodEnv
      throw new Error("SharedALB is not yet supported");
      // res.prodEnv = Environments.find((env) => env.EnvironmentId === prodId);
      // res.stagingEnv = Environments.find(
      //   (env) => env.EnvironmentName !== res.prodEnv.EnvironmentName
      // );
      break;

    case DeploymentStrategy.SwapCNAMEs:
      const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
      return {
        prodEnv: Environments.find((env) => env.CNAME === prodDomain),
        stagingEnv: Environments.find((env) => env.CNAME !== prodDomain),
      };

    default:
      throw new Error(`Unknown strategy: ${inputs.strategy}`);
  }
}
