import {
  DescribeEnvironmentsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, Inputs } from "./index";
import { createEnvironment } from "./createEnvironment";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function getTargetEnv(inputs: Inputs): Promise<string> {
  const { Environments } = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: inputs.appName,
      EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
      IncludeDeleted: false,
    })
  );

  const prodEnv = Environments.find((env) =>
    env.CNAME.startsWith(inputs.productionCNAME)
  );
  const stagingEnv = Environments.find((env) =>
    env.CNAME.startsWith(inputs.stagingCNAME)
  );
  const createStagingEnvironment = () =>
    createEnvironment({
      appName: inputs.appName,
      cname: inputs.stagingCNAME,
      envName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      platformBranchName: inputs.platformBranchName,
      templateName: inputs.templateName,
    });

  console.log(Environments);
  if (!stagingEnv) {
    console.log("Staging environment not found. Creating new environment...");
    await createStagingEnvironment();
  } else {
    if (stagingEnv.Status !== "Ready") {
      console.log("Staging environment is not ready. Waiting for it...");
      const interval = setDescribeEventsInterval(stagingEnv.EnvironmentId);
      await waitUntilEnvironmentExists(
        { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [stagingEnv.EnvironmentId] }
      );
      clearInterval(interval);
    }
    if (stagingEnv.Health !== "Green") {
      console.log("Staging environment is not healthy.");
      await terminateEnvironment(stagingEnv.EnvironmentId);
      await createStagingEnvironment();
    }
  }

  return "foo-env";
}
