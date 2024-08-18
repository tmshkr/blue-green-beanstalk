import * as core from "@actions/core";
export type ActionInputs = ReturnType<typeof getInputs>;
import { readFileSync } from "fs";

export function getInputs() {
  const inputs = {
    app_name: core.getInput("app_name", { required: true }),
    aws_region:
      core.getInput("aws_region") ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION,
    blue_env: core.getInput("blue_env"),
    create_environment: core.getBooleanInput("create_environment", {
      required: true,
    }),
    deploy: core.getBooleanInput("deploy", { required: true }),
    disable_termination_protection: core.getBooleanInput(
      "disable_termination_protection"
    ),
    enable_termination_protection: core.getBooleanInput(
      "enable_termination_protection"
    ),
    green_env: core.getInput("green_env"),
    minimum_health_color: mapHealthColorToInt(
      core.getInput("minimum_health_color", {
        required: true,
      })
    ),
    option_settings: core.getInput("option_settings")
      ? JSON.parse(readFileSync(core.getInput("option_settings"), "utf8"))
      : undefined,
    platform_branch_name: core.getInput("platform_branch_name"),
    production_cname: core.getInput("production_cname"),
    send_command: core.getInput("send_command") || undefined,
    source_bundle: core.getInput("source_bundle") || undefined,
    staging_cname: core.getInput("staging_cname"),
    swap_cnames: core.getBooleanInput("swap_cnames", { required: true }),
    single_env: core.getInput("single_env") || undefined,
    single_env_cname: core.getInput("single_env_cname") || undefined,
    template_name: core.getInput("template_name") || undefined,
    terminate_unhealthy_environment: core.getBooleanInput(
      "terminate_unhealthy_environment",
      { required: true }
    ),
    update_environment: core.getBooleanInput("update_environment", {
      required: true,
    }),
    update_listener_rules: core.getBooleanInput("update_listener_rules", {
      required: true,
    }),
    update_listener_rules_cname: core.getInput("update_listener_rules", {
      required: true,
    }),
    version_description: core.getInput("version_description") || undefined,
    version_label: core.getInput("version_label") || undefined,
    wait_for_command: core.getBooleanInput("wait_for_command"),
    wait_for_deployment: core.getBooleanInput("wait_for_deployment", {
      required: true,
    }),
    wait_for_environment: core.getBooleanInput("wait_for_environment", {
      required: true,
    }),
    wait_for_termination: core.getBooleanInput("wait_for_termination", {
      required: true,
    }),
    use_default_option_settings: core.getBooleanInput(
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
  if (!inputs.aws_region) {
    throw new Error("aws_region must be provided");
  }
  if (!inputs.version_label && inputs.source_bundle) {
    throw new Error("source_bundle must be provided with a version_label");
  }

  if (inputs.option_settings && !Array.isArray(inputs.option_settings)) {
    throw new Error("option_settings must be an array");
  }

  if (inputs.single_env || inputs.single_env_cname) {
    if (!inputs.single_env || !inputs.single_env_cname) {
      throw new Error(
        "single_env and single_env_cname must be provided together"
      );
    }
    if (
      inputs.blue_env ||
      inputs.green_env ||
      inputs.production_cname ||
      inputs.staging_cname
    ) {
      throw new Error(
        "blue_env, green_env, production_cname, and staging_cname must not be provided when using a single environment"
      );
    }
  } else {
    // blue/green input checks
    if (
      !inputs.blue_env ||
      !inputs.green_env ||
      !inputs.production_cname ||
      !inputs.staging_cname
    ) {
      throw new Error(
        "blue_env, green_env, production_cname, and staging_cname must be provided together"
      );
    }
    if (inputs.blue_env === inputs.green_env) {
      throw new Error("blue_env and green_env must be different");
    }
    if (inputs.production_cname === inputs.staging_cname) {
      throw new Error("production_cname and staging_cname must be different");
    }
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
