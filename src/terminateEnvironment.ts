import {
  ElasticBeanstalkClient,
  TerminateEnvironmentCommand,
  waitUntilEnvironmentTerminated,
} from "@aws-sdk/client-elastic-beanstalk";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { ActionInputs } from "./inputs";

export async function terminateEnvironment(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs,
  environmentId: string,
  environmentName: string
) {
  if (!inputs.terminateUnhealthyEnvironment) {
    throw new Error(
      "Target environment is unhealthy and terminate_unhealthy_environment is set to false."
    );
  }

  console.log(`Terminating environment ${environmentId} ${environmentName}...`);
  const startTime = new Date();
  await client.send(
    new TerminateEnvironmentCommand({
      EnvironmentId: environmentId,
    })
  );

  if (inputs.waitForEnvironment) {
    const interval = setDescribeEventsInterval(
      client,
      environmentId,
      startTime
    );
    await waitUntilEnvironmentTerminated(
      { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [environmentId] }
    );
    clearInterval(interval);
  } else
    throw new Error(
      "Target environment is terminating and wait_for_environment is set to false."
    );
}
