import {
  waitUntilEnvironmentExists,
  waitUntilEnvironmentTerminated,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { ActionInputs } from "./inputs";
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
    if (inputs.waitForEnvironment) {
      console.log("Target environment is terminating. Waiting...");
      const interval = setDescribeEventsInterval(targetEnv.EnvironmentId);
      await waitUntilEnvironmentTerminated(
        { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return null;
    } else
      throw new Error(
        "Target environment is terminating and wait_for_environment is set to false."
      );
  } else if (targetEnv.Status !== "Ready") {
    if (inputs.waitForEnvironment) {
      console.log("Target environment is not ready. Waiting...");
      const interval = setDescribeEventsInterval(targetEnv.EnvironmentId);
      await waitUntilEnvironmentExists(
        { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return getTargetEnv(inputs);
    } else
      throw new Error(
        "Target environment is not ready and wait_for_environment is set to false."
      );
  }

  switch (targetEnv.Health) {
    case "Green":
      console.log("Target environment's health is Green.");
      return targetEnv;

    case "Yellow":
      console.log("Target environment's health is Yellow.");
      await terminateEnvironment(
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return null;

    case "Red":
      console.log("Target environment's health is Red.");
      await terminateEnvironment(
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return null;

    case "Grey":
      console.log("Target environment's health is Grey.");
      await terminateEnvironment(
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return null;

    default:
      throw new Error("Target environment is unknown.");
  }
}
