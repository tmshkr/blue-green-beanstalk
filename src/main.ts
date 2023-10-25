import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import * as core from "@actions/core";

import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { createEnvironment } from "./createEnvironment";
import { deploy } from "./deploy";
import { swapCNAMES } from "./swapCNAMES";
import { ActionInputs, getCredentials } from "./inputs";
import { handleSharedALB } from "./strategies/shared_alb/handleSharedALB";
import { handleSwapCNAMEs } from "./strategies/swap_cnames/handleSwapCNAMEs";

export async function main(inputs: ActionInputs) {
  try {
    const client = new ElasticBeanstalkClient({
      region: inputs.awsRegion,
      credentials: getCredentials(),
    });

    const applicationVersion = await getApplicationVersion(client, inputs);
    let targetEnv = await getTargetEnv(client, inputs);

    if (inputs.deploy) {
      if (targetEnv) {
        await deploy(client, inputs, targetEnv, applicationVersion);
      } else {
        targetEnv = await createEnvironment(client, inputs, applicationVersion);
      }
      if (inputs.promote && inputs.waitForEnvironment) {
        await swapCNAMES(client, inputs);
      }
    }

    core.setOutput("target_env", targetEnv?.EnvironmentName || "");
  } catch (err) {
    core.setFailed(err.message);
    return Promise.reject(err);
  }
}
