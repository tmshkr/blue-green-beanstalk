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
  if (!inputs.terminate_unhealthy_environment) {
    throw new Error(
      "Target environment is unhealthy and terminate_unhealthy_environment is false. Exiting..."
    );
  }

  if (inputs.update_listener_rules) {
    await removeTargetGroups(inputs);
  }

  if (inputs.disable_termination_protection) {
    await disableTerminationProtection(env);
  }

  console.log(
    `Terminating environment ${env.EnvironmentName} ${env.EnvironmentId}...`
  );
  const startTime = new Date();
  await ebClient.send(
    new TerminateEnvironmentCommand({
      EnvironmentId: env.EnvironmentId,
    })
  );

  if (inputs.wait_for_termination) {
    const interval = setDescribeEventsInterval({
      inputs,
      environment: env,
      startTime,
    });
    await waitUntilEnvironmentTerminated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [env.EnvironmentId] }
    );
    clearInterval(interval);
  } else
    throw new Error(
      "Target environment is terminating and wait_for_termination is false. Exiting..."
    );
}
