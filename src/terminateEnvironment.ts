import {
  TerminateEnvironmentCommand,
  waitUntilEnvironmentTerminated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { ActionInputs } from "./inputs";

export async function terminateEnvironment(
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
  await ebClient.send(
    new TerminateEnvironmentCommand({
      EnvironmentId: environmentId,
    })
  );

  if (inputs.waitForTermination) {
    const interval = setDescribeEventsInterval(environmentId, startTime);
    await waitUntilEnvironmentTerminated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [environmentId] }
    );
    clearInterval(interval);
  } else
    throw new Error(
      "Target environment is terminating and wait_for_environment is set to false."
    );
}
