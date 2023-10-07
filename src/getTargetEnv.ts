import {
  ApplicationVersionDescription,
  DescribeEnvironmentsCommand,
  waitUntilEnvironmentExists,
  waitUntilEnvironmentTerminated,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, ActionInputs } from "./index";
import { createEnvironment } from "./createEnvironment";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { context } from "@actions/github/lib/utils";

export async function getTargetEnv(
  inputs: ActionInputs,
  applicationVersion: ApplicationVersionDescription,
  context: { didCreateEnv: boolean }
): Promise<EnvironmentDescription> {
  const { Environments } = await client.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: inputs.appName,
      EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
      IncludeDeleted: false,
    })
  );

  const prodEnv = Environments.find(
    (env) =>
      env.CNAME ===
      `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
  );
  const stagingEnv = Environments.find(
    (env) =>
      env.CNAME ===
      `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
  );
  const targetEnv = prodEnv ? stagingEnv : prodEnv;

  const createTargetEnvironment = async () => {
    const targetEnv = await createEnvironment({
      appName: inputs.appName,
      cname: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      envName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      platformBranchName: inputs.platformBranchName,
      templateName: inputs.templateName,
      versionLabel: applicationVersion.VersionLabel,
    });
    context.didCreateEnv = true;
    return targetEnv;
  };

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
    return getTargetEnv(inputs, applicationVersion, context);
  } else if (targetEnv.Status !== "Ready") {
    console.log("Target environment is not ready. Waiting...");
    const interval = setDescribeEventsInterval(targetEnv.EnvironmentId);
    await waitUntilEnvironmentExists(
      { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [targetEnv.EnvironmentId] }
    );
    clearInterval(interval);
    return getTargetEnv(inputs, applicationVersion, context);
  }

  switch (targetEnv.Health) {
    case "Green":
      console.log("Target environment's health is Green.");
      break;
    case "Yellow":
      console.log("Target environment's health is Yellow.");
      if (inputs.terminateUnhealthyEnvironment) {
        console.log("Terminating unhealthy environment...");
        await terminateEnvironment(
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return await createTargetEnvironment();
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    case "Grey":
      console.log("Target environment's health is Grey.");
      if (inputs.terminateUnhealthyEnvironment) {
        console.log("Terminating unhealthy environment...");
        await terminateEnvironment(
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return await createTargetEnvironment();
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    case "Red":
      console.log("Target environment's health is Red.");
      if (inputs.terminateUnhealthyEnvironment) {
        console.log("Terminating unhealthy environment...");
        await terminateEnvironment(
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return await createTargetEnvironment();
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    default:
      throw new Error("Target environment is unknown.");
  }

  return targetEnv;
}
