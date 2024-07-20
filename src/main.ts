import {
  EnvironmentDescription,
  DescribeEnvironmentsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import * as core from "@actions/core";

import { ebClient } from "./clients";
import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { createEnvironment } from "./createEnvironment";
import { updateEnvironment } from "./updateEnvironment";
import { swapCNAMEs } from "./swapCNAMEs";
import { ActionInputs } from "./inputs";
import { enableTerminationProtection } from "./updateTerminationProtection";
import { sendCommand } from "./sendCommand";
import { updateTargetGroups } from "./updateListenerRules";

export async function main(inputs: ActionInputs) {
  let targetEnv: EnvironmentDescription | null = null;
  try {
    const applicationVersion = await getApplicationVersion(inputs);
    targetEnv = await getTargetEnv(inputs);

    if (inputs.deploy) {
      if (targetEnv && inputs.updateEnvironment) {
        await updateEnvironment(inputs, targetEnv, applicationVersion);
      } else if (!targetEnv && inputs.createEnvironment) {
        targetEnv = await createEnvironment(inputs, applicationVersion);
      }
    }

    if (inputs.enableTerminationProtection) {
      await enableTerminationProtection(targetEnv);
    }

    if (inputs.send_command) {
      await sendCommand(inputs, targetEnv);
    }

    if (inputs.swapCNAMEs) {
      await swapCNAMEs(inputs);
    }

    if (inputs.updateListenerRules) {
      await updateTargetGroups(inputs);
    }
  } catch (err) {
    core.setFailed(err.message);
    return Promise.reject(err);
  }

  await setOutputs(targetEnv);
}

export async function setOutputs(targetEnv: EnvironmentDescription) {
  if (targetEnv) {
    targetEnv = await ebClient
      .send(
        new DescribeEnvironmentsCommand({
          EnvironmentIds: [targetEnv.EnvironmentId],
        })
      )
      .then(({ Environments }) => Environments[0]);
  }

  core.setOutput("target_env_cname", targetEnv?.CNAME || "");
  core.setOutput("target_env_endpoint_url", targetEnv?.EndpointURL || "");
  core.setOutput("target_env_id", targetEnv?.EnvironmentId || "");
  core.setOutput("target_env_json", JSON.stringify(targetEnv) || "");
  core.setOutput("target_env_name", targetEnv?.EnvironmentName || "");
  core.setOutput("target_env_status", targetEnv?.Status || "");
}
