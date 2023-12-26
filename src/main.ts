import {
  EnvironmentDescription,
  DescribeEnvironmentsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import * as core from "@actions/core";

import { ebClient } from "./clients";
import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { createEnvironment } from "./createEnvironment";
import { deploy } from "./deploy";
import { swapCNAMES } from "./swapCNAMES";
import { ActionInputs } from "./inputs";
import { enableTerminationProtection } from "./updateTerminationProtection";

export async function main(inputs: ActionInputs) {
  try {
    const applicationVersion = await getApplicationVersion(inputs);
    let targetEnv = await getTargetEnv(inputs);

    if (inputs.prep) {
      if (!targetEnv) {
        targetEnv = await createEnvironment(inputs, applicationVersion);
      }
      await setOutputs(targetEnv);
      return;
    }

    if (inputs.deploy) {
      if (targetEnv) {
        await deploy(inputs, targetEnv, applicationVersion);
      } else {
        targetEnv = await createEnvironment(inputs, applicationVersion);
      }
    }

    if (inputs.enableTerminationProtection) {
      await enableTerminationProtection(targetEnv);
    }

    if (inputs.swapCNAMEs) {
      console.log(
        `Promoting environment ${targetEnv.EnvironmentName} to production...`
      );
      if (!targetEnv) {
        throw new Error("No target environment to promote");
      }
      await ebClient
        .send(
          new DescribeEnvironmentsCommand({
            EnvironmentIds: [targetEnv.EnvironmentId],
          })
        )
        .then(({ Environments }) => {
          if (Environments[0].Health !== "Green") {
            throw new Error(
              `Environment ${targetEnv.EnvironmentName} is not healthy. Aborting promotion.`
            );
          }
          if (Environments[0].Status !== "Ready") {
            throw new Error(
              `Environment ${targetEnv.EnvironmentName} is not ready. Aborting promotion.`
            );
          }
        });

      await swapCNAMES(inputs);
    }

    await setOutputs(targetEnv);
  } catch (err) {
    core.setFailed(err.message);
    return Promise.reject(err);
  }
}

async function setOutputs(targetEnv: EnvironmentDescription) {
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
