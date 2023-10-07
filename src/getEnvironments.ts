import {
  DescribeEnvironmentsCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, ActionInputs } from "./index";

export async function getEnvironments(inputs: ActionInputs): Promise<{
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

  return {
    prodEnv: Environments.find(
      (env) =>
        env.CNAME ===
        `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
    ),
    stagingEnv: Environments.find(
      (env) =>
        env.CNAME ===
        `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
    ),
  };
}
