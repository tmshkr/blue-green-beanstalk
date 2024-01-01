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
import { setOutputs } from "./main";

export async function terminateEnvironment(
  inputs: ActionInputs,
  env: EnvironmentDescription
) {
  if (!inputs.terminateUnhealthyEnvironment) {
    await setOutputs(env);
    process.exit(0);
  }

  if (inputs.updateListenerRules) {
    await removeTargetGroups(inputs);
  }

  if (inputs.disableTerminationProtection) {
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

  if (inputs.waitForTermination) {
    const interval = setDescribeEventsInterval(env.EnvironmentId, startTime);
    await waitUntilEnvironmentTerminated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [env.EnvironmentId] }
    );
    clearInterval(interval);
  } else {
    await setOutputs(env);
    process.exit(0);
  }
}
