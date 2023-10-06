import {
  DescribeEnvironmentsCommand,
  waitUntilEnvironmentExists,
  waitUntilEnvironmentTerminated,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, ActionInputs } from "./index";
import { createEnvironment } from "./createEnvironment";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function getTargetEnv(
  inputs: ActionInputs
): Promise<EnvironmentDescription> {
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
  const targetEnv = prodEnv ? stagingEnv : prodEnv;

  const createTargetEnvironment = () =>
    createEnvironment({
      appName: inputs.appName,
      cname: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      envName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      platformBranchName: inputs.platformBranchName,
      templateName: inputs.templateName,
    });

  if (!targetEnv) {
    console.log("Target environment not found. Creating new environment...");
    return await createTargetEnvironment();
  }

  if (targetEnv.Status === "Terminating") {
    console.log("Target environment is terminating. Waiting...");
    const interval = setDescribeEventsInterval(targetEnv.EnvironmentId);
    await waitUntilEnvironmentTerminated(
      { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [targetEnv.EnvironmentId] }
    );
    clearInterval(interval);
    return getTargetEnv(inputs);
  } else if (targetEnv.Status !== "Ready") {
    console.log("Target environment is not ready. Waiting...");
    const interval = setDescribeEventsInterval(targetEnv.EnvironmentId);
    await waitUntilEnvironmentExists(
      { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [targetEnv.EnvironmentId] }
    );
    clearInterval(interval);
    return getTargetEnv(inputs);
  }

  if (targetEnv.Health !== "Green") {
    console.log("Target environment is not healthy.");
    await terminateEnvironment(
      targetEnv.EnvironmentId,
      targetEnv.EnvironmentName
    );
    return await createTargetEnvironment();
  }

  return targetEnv;
}
