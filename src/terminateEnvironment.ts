import {
  EnvironmentDescription,
  TerminateEnvironmentCommand,
  waitUntilEnvironmentTerminated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { ActionInputs } from "./inputs";
import { disableTerminationProtection } from "./updateTerminationProtection";
import { removeTargetGroups } from "./updateListenerRules";

export async function terminateEnvironment(
  inputs: ActionInputs,
  env: EnvironmentDescription
) {
  if (!inputs.terminateUnhealthyEnvironment) {
    throw new Error(
      "Target environment is unhealthy and terminate_unhealthy_environment is set to false."
    );
  }

  if (inputs.updateListenerRules) {
    await removeTargetGroups(inputs);
  }

  if (inputs.disableTerminationProtection) {
    await disableTerminationProtection(env);
  }

  console.log(
    `[${env.EnvironmentName}]: Terminating environment ${env.EnvironmentId}...`
  );
  const startTime = new Date();
  await ebClient.send(
    new TerminateEnvironmentCommand({
      EnvironmentId: env.EnvironmentId,
    })
  );

  if (inputs.waitForTermination) {
    const interval = setDescribeEventsInterval(env.EnvironmentId, startTime);
    await waitUntilEnvironmentTerminated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [env.EnvironmentId] }
    );
    clearInterval(interval);
  } else
    throw new Error(
      "Target environment is terminating and wait_for_termination is set to false."
    );
}
