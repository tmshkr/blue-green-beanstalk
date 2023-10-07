import {
  waitUntilEnvironmentExists,
  waitUntilEnvironmentTerminated,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, ActionInputs } from "./index";
import { getEnvironments } from "./getEnvironments";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function getTargetEnv(
  inputs: ActionInputs
): Promise<EnvironmentDescription | null> {
  const { prodEnv, stagingEnv } = await getEnvironments(inputs);
  const targetEnv = prodEnv ? stagingEnv : undefined;

  if (!targetEnv) {
    console.log("Target environment not found.");
    return null;
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
        return null;
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
        return null;
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
        return null;
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    default:
      throw new Error("Target environment is unknown.");
  }

  return targetEnv;
}
