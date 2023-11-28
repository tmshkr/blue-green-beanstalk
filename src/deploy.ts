import {
  ApplicationVersionDescription,
  EnvironmentDescription,
  UpdateEnvironmentCommand,
  waitUntilEnvironmentUpdated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { ActionInputs } from "./inputs";

export async function deploy(
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription,
  applicationVersion?: ApplicationVersionDescription
) {
  console.log(`Starting deployment to to ${targetEnv.EnvironmentName}`);
  const startTime = new Date();
  await ebClient.send(
    new UpdateEnvironmentCommand({
      EnvironmentId: targetEnv.EnvironmentId,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );

  if (!inputs.waitForDeployment) {
    return;
  }

  const interval = setDescribeEventsInterval(
    targetEnv.EnvironmentId,
    startTime
  );
  await waitUntilEnvironmentUpdated(
    { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [targetEnv.EnvironmentId] }
  );
  clearInterval(interval);
}
