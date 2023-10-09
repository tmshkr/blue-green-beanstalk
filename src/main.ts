import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import * as core from "@actions/core";

import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { createEnvironment } from "./createEnvironment";
import { deploy } from "./deploy";
import { swapCNAMES } from "./swapCNAMES";
import { ActionInputs, getCredentials } from "./inputs";

function checkInputs(inputs: ActionInputs) {
  if (inputs.blueEnv === inputs.greenEnv) {
    throw new Error("blue_env and green_env must be different");
  }

  if (inputs.productionCNAME === inputs.stagingCNAME) {
    throw new Error("production_cname and staging_cname must be different");
  }
}

export async function main(inputs: ActionInputs) {
  try {
    checkInputs(inputs);
  } catch (err) {
    core.setFailed(err.message);
    return Promise.reject(err);
  }

  const client = new ElasticBeanstalkClient({
    region: inputs.awsRegion,
    credentials: getCredentials(),
  });

  const applicationVersion = await getApplicationVersion(client, inputs);
  let targetEnv = await getTargetEnv(client, inputs);

  if (inputs.deploy) {
    if (targetEnv) {
      await deploy(client, targetEnv, applicationVersion);
    } else {
      targetEnv = await createEnvironment(client, inputs, applicationVersion);
    }
    if (inputs.swapCNAMES) {
      await swapCNAMES(client, inputs);
    }
  }

  core.setOutput("target_env", targetEnv?.EnvironmentName || "");
}
