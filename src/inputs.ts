import * as core from "@actions/core";
export type ActionInputs = ReturnType<typeof getInputs>;

export function getInputs() {
  const inputs = {
    appName: core.getInput("app_name", { required: true }),
    awsRegion: core.getInput("aws_region") || process.env.AWS_REGION,
    blueEnv: core.getInput("blue_env", { required: true }),
    deploy: core.getBooleanInput("deploy", { required: true }),
    greenEnv: core.getInput("green_env", { required: true }),
    platformBranchName: core.getInput("platform_branch_name", {
      required: true,
    }),
    productionCNAME: core.getInput("production_cname") || undefined,
    promote: core.getBooleanInput("promote", { required: true }),
    sourceBundle: core.getInput("source_bundle") || undefined,
    stagingCNAME: core.getInput("staging_cname") || undefined,
    strategy: core.getInput("strategy", { required: true }),
    templateName: core.getInput("template_name") || undefined,
    terminateUnhealthyEnvironment: core.getBooleanInput(
      "terminate_unhealthy_environment",
      { required: true }
    ),
    versionDescription: core.getInput("version_description") || undefined,
    versionLabel: core.getInput("version_label") || undefined,
    waitForEnvironment: core.getBooleanInput("wait_for_environment", {
      required: true,
    }),
    useDefaultOptionSettings: core.getBooleanInput(
      "use_default_option_settings",
      {
        required: true,
      }
    ),
  };

  try {
    checkInputs(inputs);
  } catch (err) {
    core.setFailed(err.message);
    throw err;
  }
  return inputs;
}

export enum DeploymentStrategy {
  SharedALB = "shared_alb",
  SwapCNAMEs = "swap_cnames",
}

function checkInputs(inputs: ActionInputs) {
  if (!inputs.awsRegion) {
    throw new Error("aws_region must be provided");
  }

  if (inputs.blueEnv === inputs.greenEnv) {
    throw new Error("blue_env and green_env must be different");
  }

  if (
    (inputs.versionLabel && !inputs.sourceBundle) ||
    (!inputs.versionLabel && inputs.sourceBundle)
  ) {
    throw new Error(
      "version_label and source_bundle must be provided together"
    );
  }

  if (
    ![DeploymentStrategy.SharedALB, DeploymentStrategy.SwapCNAMEs].includes(
      inputs.strategy as unknown & DeploymentStrategy
    )
  ) {
    throw new Error("strategy must be one of: shared_alb, swap_cnames");
  }

  if (inputs.strategy === DeploymentStrategy.SwapCNAMEs) {
    if (!inputs.productionCNAME) {
      throw new Error(
        "production_cname is required when using the swap_cnames strategy"
      );
    }
    if (inputs.productionCNAME === inputs.stagingCNAME) {
      throw new Error("production_cname and staging_cname must be different");
    }
  } else if (inputs.productionCNAME || inputs.stagingCNAME) {
    core.warning(
      "production_cname and staging_cname are ignored when not using the swap_cnames strategy"
    );
  }
}

export function getCredentials() {
  const credentials = {
    accessKeyId:
      process.env.INPUT_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.INPUT_AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken:
      process.env.INPUT_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
  };
  return (credentials.accessKeyId && credentials.secretAccessKey) ||
    credentials.sessionToken
    ? credentials
    : undefined;
}
