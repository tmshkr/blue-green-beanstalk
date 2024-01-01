import {
  DescribeEnvironmentsCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs } from "./inputs";
import { ebClient } from "./clients";

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

  const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
  const stagingDomain = `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
  return {
    prodEnv: Environments.find(({ CNAME }) => CNAME === prodDomain),
    stagingEnv: Environments.find(({ CNAME }) => CNAME === stagingDomain),
  };
}
