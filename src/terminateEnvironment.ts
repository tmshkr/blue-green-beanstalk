import {
  TerminateEnvironmentCommand,
  waitUntilEnvironmentTerminated,
} from "@aws-sdk/client-elastic-beanstalk";
import { client } from "./index";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function terminateEnvironment(
  environmentId: string,
  environmentName: string
): Promise<void> {
  console.log(`Terminating environment ${environmentId} ${environmentName}...`);
  const startTime = new Date();
  await client.send(
    new TerminateEnvironmentCommand({
      EnvironmentId: environmentId,
    })
  );
  const interval = setDescribeEventsInterval(environmentId, startTime);
  await waitUntilEnvironmentTerminated(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [environmentId] }
  );
  clearInterval(interval);
}
