import {
  ApplicationVersionDescription,
  EnvironmentDescription,
  UpdateEnvironmentCommand,
  waitUntilEnvironmentUpdated,
} from "@aws-sdk/client-elastic-beanstalk";
import { client } from ".";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function deploy(
  targetEnv: EnvironmentDescription,
  applicationVersion: ApplicationVersionDescription
) {
  console.log(`Starting deployment to to ${targetEnv.EnvironmentName}`);
  const startTime = new Date();
  const res = await client.send(
    new UpdateEnvironmentCommand({
      EnvironmentId: targetEnv.EnvironmentId,
      VersionLabel: applicationVersion.VersionLabel,
    })
  );
  console.log(res);
  const interval = setDescribeEventsInterval(
    targetEnv.EnvironmentId,
    startTime
  );
  await waitUntilEnvironmentUpdated(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [targetEnv.EnvironmentId] }
  );
  clearInterval(interval);
}
