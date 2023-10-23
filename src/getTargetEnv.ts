import {
  waitUntilEnvironmentExists,
  waitUntilEnvironmentTerminated,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs } from "./inputs";
import { getEnvironments } from "./getEnvironments";
import { terminateEnvironment } from "./terminateEnvironment";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function getTargetEnv(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs
): Promise<EnvironmentDescription | null> {
  const { prodEnv, stagingEnv } = await getEnvironments(client, inputs);
  const targetEnv = prodEnv ? stagingEnv : undefined;

  if (!targetEnv) {
    console.log("Target environment not found.");
    return null;
  }

  if (targetEnv.Status === "Terminating") {
    if (inputs.waitForEnvironment) {
      console.log("Target environment is terminating. Waiting...");
      const interval = setDescribeEventsInterval(
        client,
        targetEnv.EnvironmentId
      );
      await waitUntilEnvironmentTerminated(
        { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return getTargetEnv(client, inputs);
    } else {
      throw new Error(
        "Target environment is terminating and wait_for_environment is set to false."
      );
    }
  } else if (targetEnv.Status !== "Ready") {
    if (inputs.waitForEnvironment) {
      console.log("Target environment is not ready. Waiting...");
      const interval = setDescribeEventsInterval(
        client,
        targetEnv.EnvironmentId
      );
      await waitUntilEnvironmentExists(
        { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
        { EnvironmentIds: [targetEnv.EnvironmentId] }
      );
      clearInterval(interval);
      return getTargetEnv(client, inputs);
    } else {
      throw new Error(
        "Target environment is not ready and wait_for_environment is set to false."
      );
    }
  }

  switch (targetEnv.Health) {
    case "Green":
      console.log("Target environment's health is Green.");
      return targetEnv;

    case "Yellow":
      console.log("Target environment's health is Yellow.");
      await terminateEnvironment(
        client,
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return getTargetEnv(client, inputs);

    case "Red":
      console.log("Target environment's health is Red.");
      await terminateEnvironment(
        client,
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return getTargetEnv(client, inputs);

    case "Grey":
      console.log("Target environment's health is Grey.");
      await terminateEnvironment(
        client,
        inputs,
        targetEnv.EnvironmentId,
        targetEnv.EnvironmentName
      );
      return getTargetEnv(client, inputs);

    default:
      throw new Error("Target environment is unknown.");
  }
}
