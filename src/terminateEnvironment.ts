import {
  ElasticBeanstalkClient,
  TerminateEnvironmentCommand,
  waitUntilEnvironmentTerminated,
} from "@aws-sdk/client-elastic-beanstalk";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

export async function terminateEnvironment(
  client: ElasticBeanstalkClient,
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
  const interval = setDescribeEventsInterval(client, environmentId, startTime);
  await waitUntilEnvironmentTerminated(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [environmentId] }
  );
  clearInterval(interval);
}
