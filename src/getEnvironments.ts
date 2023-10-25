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

  const res = { prodEnv: undefined, stagingEnv: undefined };

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
      console.log(Environments);
      console.log(loadBalancers);
      if (loadBalancers.find((arn) => /:loadbalancer\/[^app]/.test(arn))) {
        throw new Error("Only Application Load Balancers are supported");
      }
      if (loadBalancers.find((arn) => /:loadbalancer\/app\/awseb/.test(arn))) {
        throw new Error(
          "Dedicated Load Balancers created by Elastic Beanstalk are not supported"
        );
      }

      const uniqueLoadBalancers = new Set(loadBalancers);
      if (uniqueLoadBalancers.size > 1) {
        throw new Error(
          "All environments must share the same Application Load Balancer"
        );
      }

      if (uniqueLoadBalancers.size === 0) {
        // create alb
      }

      // get the tags for the default target group, which will have the id of the prodEnv
      throw new Error("SharedALB is not yet supported");
      const prodId = "e-n2rmjanmdh";
      res.prodEnv = Environments.find((env) => env.EnvironmentId === prodId);
      res.stagingEnv = Environments.find(
        (env) => env.EnvironmentName !== res.prodEnv.EnvironmentName
      );
      break;

    case DeploymentStrategy.SwapCNAMEs:
      const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
      res.prodEnv = Environments.find((env) => env.CNAME === prodDomain);
      res.stagingEnv = Environments.find((env) => env.CNAME !== prodDomain);
      break;

    default:
      throw new Error(`Unknown strategy: ${inputs.strategy}`);
  }

  return res;
}
