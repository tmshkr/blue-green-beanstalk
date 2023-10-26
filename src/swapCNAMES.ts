import {
  DescribeEnvironmentsCommand,
  SwapEnvironmentCNAMEsCommand,
  waitUntilEnvironmentUpdated,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { ActionInputs } from "./inputs";
const core = require("@actions/core");

export async function swapCNAMES(inputs: ActionInputs) {
  const { Environments } = await ebClient.send(
    new DescribeEnvironmentsCommand({
      ApplicationName: inputs.appName,
      EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
      IncludeDeleted: false,
    })
  );

  const blueEnv = Environments.find(
    (env) => env.EnvironmentName === inputs.blueEnv
  );
  const greenEnv = Environments.find(
    (env) => env.EnvironmentName === inputs.greenEnv
  );

  if (!blueEnv || !greenEnv) {
    core.warning("Blue or green environment not found. Cannot swap CNAMES...");
    return;
  }

  if (blueEnv.Status !== "Ready" || greenEnv.Status !== "Ready") {
    core.info("Environments not yet ready. Waiting...");
    await waitUntilEnvironmentUpdated(
      { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
      { EnvironmentIds: [blueEnv.EnvironmentId, greenEnv.EnvironmentId] }
    );
  }

  core.info("Swapping CNAMES...");
  await ebClient.send(
    new SwapEnvironmentCNAMEsCommand({
      DestinationEnvironmentId: blueEnv.EnvironmentId,
      SourceEnvironmentId: greenEnv.EnvironmentId,
    })
  );
  await waitUntilEnvironmentUpdated(
    { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [blueEnv.EnvironmentId, greenEnv.EnvironmentId] }
  );
}
