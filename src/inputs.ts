import * as core from "@actions/core";
export type ActionInputs = ReturnType<typeof getInputs>;
const fs = require("fs");

export function getInputs() {
  const inputs = {
    appName: core.getInput("app_name", { required: true }),
    awsRegion:
      core.getInput("aws_region") ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION,
    blueEnv: core.getInput("blue_env", { required: true }),
    createEnvironment: core.getBooleanInput("create_environment", {
      required: true,
    }),
    deploy: core.getBooleanInput("deploy", { required: true }),
    disableTerminationProtection: core.getBooleanInput(
      "disable_termination_protection"
    ),
    enableTerminationProtection: core.getBooleanInput(
      "enable_termination_protection"
    ),
    greenEnv: core.getInput("green_env", { required: true }),
    minimumHealthColor: mapHealthColorToInt(
      core.getInput("minimum_health_color", {
        required: true,
      })
    ),
    optionSettings: core.getInput("option_settings")
      ? JSON.parse(fs.readFileSync(core.getInput("option_settings")))
      : undefined,
    platformBranchName: core.getInput("platform_branch_name"),
    productionCNAME: core.getInput("production_cname", { required: true }),
    sourceBundle: core.getInput("source_bundle") || undefined,
    stagingCNAME: core.getInput("staging_cname", { required: true }),
    swapCNAMEs: core.getBooleanInput("swap_cnames", { required: true }),
    templateName: core.getInput("template_name") || undefined,
    terminateUnhealthyEnvironment: core.getBooleanInput(
      "terminate_unhealthy_environment",
      { required: true }
    ),
    updateEnvironment: core.getBooleanInput("update_environment", {
      required: true,
    }),
    updateListenerRules: core.getBooleanInput("update_listener_rules", {
      required: true,
    }),
    versionDescription: core.getInput("version_description") || undefined,
    versionLabel: core.getInput("version_label") || undefined,
    waitForDeployment: core.getBooleanInput("wait_for_deployment", {
      required: true,
    }),
    waitForEnvironment: core.getBooleanInput("wait_for_environment", {
      required: true,
    }),
    waitForTermination: core.getBooleanInput("wait_for_termination", {
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

export function checkInputs(inputs: ActionInputs) {
  if (!inputs.awsRegion) {
    throw new Error("aws_region must be provided");
  }

  if (inputs.blueEnv === inputs.greenEnv) {
    throw new Error("blue_env and green_env must be different");
  }

  if (!inputs.versionLabel && inputs.sourceBundle) {
    throw new Error("source_bundle must be provided with a version_label");
  }

  if (inputs.productionCNAME === inputs.stagingCNAME) {
    throw new Error("production_cname and staging_cname must be different");
  }

  if (inputs.optionSettings && !Array.isArray(inputs.optionSettings)) {
    throw new Error("option_settings must be an array");
  }
}

export function mapHealthColorToInt(healthColor: string) {
  switch (healthColor.toUpperCase()) {
    case "GREEN":
      return 3;
    case "YELLOW":
      return 2;
    case "RED":
      return 1;
    case "GREY":
      return 0;
    default:
      throw new Error("Invalid health color");
  }
}
