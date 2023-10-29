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
import { ActionInputs, DeploymentStrategy } from "./inputs";
import { updateListener } from "./updateListener";

export async function main(inputs: ActionInputs) {
  try {
    const applicationVersion = await getApplicationVersion(inputs);
    let targetEnv = await getTargetEnv(inputs);

    if (inputs.deploy) {
      if (targetEnv) {
        await deploy(inputs, targetEnv, applicationVersion);
      } else {
        targetEnv = await createEnvironment(inputs, applicationVersion);
      }
    }

    if (inputs.promote) {
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
        });

      switch (inputs.strategy) {
        case DeploymentStrategy.SharedALB:
          await updateListener(inputs, targetEnv);
          break;
        case DeploymentStrategy.SwapCNAMEs:
          await swapCNAMES(inputs);
          break;
        default:
          throw new Error(`Unknown strategy: ${inputs.strategy}`);
      }
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
