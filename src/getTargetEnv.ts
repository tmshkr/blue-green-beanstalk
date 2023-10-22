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
      console.log("Target environment is terminating. Exiting...");
      process.exit(1);
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
      console.log("Target environment is not ready. Exiting...");
      process.exit(1);
    }
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
          client,
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return getTargetEnv(client, inputs);
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    case "Red":
      console.log("Target environment's health is Red.");
      if (inputs.terminateUnhealthyEnvironment) {
        console.log("Terminating unhealthy environment...");
        await terminateEnvironment(
          client,
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return getTargetEnv(client, inputs);
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    case "Grey":
      console.log("Target environment's health is Grey.");
      if (inputs.terminateUnhealthyEnvironment) {
        console.log("Terminating unhealthy environment...");
        await terminateEnvironment(
          client,
          targetEnv.EnvironmentId,
          targetEnv.EnvironmentName
        );
        return getTargetEnv(client, inputs);
      } else {
        console.log("Exiting...");
        process.exit(1);
      }
    default:
      throw new Error("Target environment is unknown.");
  }

  return targetEnv;
}
