import {
  ApplicationVersionDescription,
  EnvironmentDescription,
  UpdateEnvironmentCommand,
  waitUntilEnvironmentUpdated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { ActionInputs } from "./inputs";

export async function updateEnvironment(
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription,
  applicationVersion?: ApplicationVersionDescription
) {
  console.log(`Starting deployment to to ${targetEnv.EnvironmentName}`);
  const startTime = new Date();
  await ebClient.send(
    new UpdateEnvironmentCommand({
      EnvironmentId: targetEnv.EnvironmentId,
      OptionSettings: inputs.option_settings,
      TemplateName: inputs.template_name,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );

  if (!inputs.wait_for_deployment) {
    return;
  }

  const interval = setDescribeEventsInterval({
    environment: targetEnv,
    inputs,
    startTime,
  });
  await waitUntilEnvironmentUpdated(
    { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [targetEnv.EnvironmentId] }
  );
  clearInterval(interval);
}
