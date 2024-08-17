import {
  DescribeEnvironmentsCommand,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs } from "./inputs";
import { ebClient } from "./clients";

export async function getEnvironments(inputs: ActionInputs): Promise<{
  prodEnv: EnvironmentDescription | undefined;
  stagingEnv: EnvironmentDescription | undefined;
  singleEnv: EnvironmentDescription | undefined;
}> {
  const { Environments } = await ebClient.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: inputs.app_name,
      EnvironmentNames: inputs.single_env
        ? [inputs.single_env]
        : [inputs.blue_env, inputs.green_env],
      IncludeDeleted: false,
    })
  );

  if (Environments.length === 0) {
    return {
      prodEnv: undefined,
      stagingEnv: undefined,
      singleEnv: undefined,
    };
  }

  if (inputs.single_env) {
    return {
      prodEnv: undefined,
      stagingEnv: undefined,
      singleEnv: Environments[0],
    };
  } else {
    const prodDomain = `${inputs.production_cname}.${inputs.aws_region}.elasticbeanstalk.com`;
    const stagingDomain = `${inputs.staging_cname}.${inputs.aws_region}.elasticbeanstalk.com`;
    return {
      prodEnv: Environments.find(({ CNAME }) => CNAME === prodDomain),
      stagingEnv: Environments.find(({ CNAME }) => CNAME === stagingDomain),
      singleEnv: undefined,
    };
  }
}
