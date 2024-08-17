import {
  SwapEnvironmentCNAMEsCommand,
  waitUntilEnvironmentUpdated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { ActionInputs, mapHealthColorToInt } from "./inputs";
import { getEnvironments } from "./getEnvironments";
const core = require("@actions/core");

export async function swapCNAMEs(inputs: ActionInputs) {
  if (inputs.single_env) {
    core.warning("Cannot swap CNAMEs with a single environment...");
    return;
  }

  const { stagingEnv, prodEnv } = await getEnvironments(inputs);
  if (!stagingEnv || !prodEnv) {
    core.warning("Cannot swap CNAMEs without both environments...");
    return;
  }

  if (mapHealthColorToInt(stagingEnv.Health) < inputs.minimum_health_color) {
    throw new Error(`Target environment is not healthy. Cannot swap CNAMEs.`);
  }

  if (stagingEnv.Status !== "Ready" || prodEnv.Status !== "Ready") {
    core.info("Environments not yet ready. Waiting...");
    await waitUntilEnvironmentUpdated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      {
        EnvironmentIds: [stagingEnv.EnvironmentId, prodEnv.EnvironmentId],
      }
    );
  }

  core.info("Swapping CNAMEs...");
  await ebClient.send(
    new SwapEnvironmentCNAMEsCommand({
      DestinationEnvironmentId: prodEnv.EnvironmentId,
      SourceEnvironmentId: stagingEnv.EnvironmentId,
    })
  );
  await waitUntilEnvironmentUpdated(
    { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [stagingEnv.EnvironmentId, prodEnv.EnvironmentId] }
  );
}
