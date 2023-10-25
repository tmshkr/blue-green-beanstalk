import {
  ElasticBeanstalkClient,
  EnvironmentDescription,
  DescribeEnvironmentsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import * as core from "@actions/core";

import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { createEnvironment } from "./createEnvironment";
import { deploy } from "./deploy";
import { swapCNAMES } from "./swapCNAMES";
import { ActionInputs, DeploymentStrategy, getCredentials } from "./inputs";

export async function main(inputs: ActionInputs) {
  try {
    const client = new ElasticBeanstalkClient({
      region: inputs.awsRegion,
      credentials: getCredentials(),
    });

    const applicationVersion = await getApplicationVersion(client, inputs);
    let targetEnv = await getTargetEnv(client, inputs);

    targetEnv = await handleDeploymentStrategy(
      client,
      inputs,
      targetEnv,
      applicationVersion
    );

    await setOutputs(client, targetEnv);
  } catch (err) {
    core.setFailed(err.message);
    return Promise.reject(err);
  }
}

async function handleDeploymentStrategy(
  client,
  inputs,
  targetEnv,
  applicationVersion
) {
  if (!inputs.deploy) {
    return targetEnv;
  }

  if (targetEnv) {
    await deploy(client, inputs, targetEnv, applicationVersion);
  } else {
    targetEnv = await createEnvironment(client, inputs, applicationVersion);
  }

  if (!inputs.waitForEnvironment) {
    return targetEnv;
  }

  if (inputs.promote) {
    switch (inputs.strategy) {
      case DeploymentStrategy.SharedALB:
        // updateListenerRule(client, inputs, targetEnv);
        break;
      case DeploymentStrategy.SwapCNAMEs:
        await swapCNAMES(client, inputs);
        break;
      default:
        throw new Error(`Unknown strategy: ${inputs.strategy}`);
    }
  }

  return targetEnv;
}

async function setOutputs(
  client: ElasticBeanstalkClient,
  targetEnv: EnvironmentDescription
) {
  targetEnv = await client
    .send(
      new DescribeEnvironmentsCommand({
        EnvironmentIds: [targetEnv.EnvironmentId],
      })
    )
    .then(({ Environments }) => Environments[0]);

  core.setOutput("target_env_cname", targetEnv?.CNAME || "");
  core.setOutput("target_env_id", targetEnv?.EnvironmentId || "");
  core.setOutput("target_env_json", JSON.stringify(targetEnv) || "");
  core.setOutput("target_env_endpoint_url", targetEnv?.EndpointURL || "");
  core.setOutput("target_env_name", targetEnv?.EnvironmentName || "");
  core.setOutput("target_env_status", targetEnv?.Status || "");
}
