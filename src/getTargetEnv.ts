import {
  waitUntilEnvironmentUpdated,
  waitUntilEnvironmentTerminated,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { ActionInputs, mapHealthColorToInt } from "./inputs";
import { getEnvironments } from "./getEnvironments";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function getTargetEnv(
  inputs: ActionInputs
): Promise<EnvironmentDescription | null> {
  const { prodEnv, stagingEnv, singleEnv } = await getEnvironments(inputs);
  const targetEnv = singleEnv ?? (prodEnv ? stagingEnv : undefined);

  if (!targetEnv) {
    console.log("Target environment not found.");
    return null;
  }

  if (targetEnv.Status === "Terminating") {
    if (inputs.wait_for_termination) {
      console.log("Target environment is terminating. Waiting...");
      const interval = setDescribeEventsInterval({
        environment: targetEnv,
        inputs,
      });
      await waitUntilEnvironmentTerminated(
        { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return null;
    } else
      throw new Error(
        "Target environment is terminating and wait_for_termination is false. Exiting..."
      );
  } else if (targetEnv.Status !== "Ready") {
    if (inputs.wait_for_environment) {
      console.log("Target environment is not ready. Waiting...");
      const interval = setDescribeEventsInterval({
        inputs,
        environment: targetEnv,
      });
      await waitUntilEnvironmentUpdated(
        { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return getTargetEnv(inputs);
    } else
      throw new Error(
        "Target environment is not ready and wait_for_environment is false. Exiting..."
      );
  }

  console.log(`Target environment's health is ${targetEnv.Health}.`);
  if (mapHealthColorToInt(targetEnv.Health) < inputs.minimum_health_color) {
    await terminateEnvironment(inputs, targetEnv);
    return null;
  } else {
    return targetEnv;
  }
}
