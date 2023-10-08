import {
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs } from "./inputs";

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

  const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
  return {
    prodEnv: Environments.find((env) => env.CNAME === prodDomain),
    stagingEnv: Environments.find((env) => env.CNAME !== prodDomain),
  };
}
