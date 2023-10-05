import { DescribeEnvironmentsCommand } from "@aws-sdk/client-elastic-beanstalk";
import { client, Inputs } from "./index";

export async function getTargetEnv(inputs: Inputs): Promise<string> {
  // check if there is an environment with the productionCNAME
  const res = await client.send(
    new DescribeEnvironmentsCommand({ ApplicationName: inputs.appName })
  );
  console.log(res);

  // if not, create it and return it as the target env

  // check if there is an environment with the stagingCNAME
  // if so, return it as the target env
  // or else create the staging environment and return it as the target env

  return "foo";
}
