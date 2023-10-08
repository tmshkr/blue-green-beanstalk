import * as core from "@actions/core";

export function getInputs() {
  return {
    appName: core.getInput("app_name", { required: true }),
    awsRegion: core.getInput("aws_region", { required: false }),
    blueEnv: core.getInput("blue_env", { required: true }),
    deploy: core.getBooleanInput("deploy", { required: true }),
    greenEnv: core.getInput("green_env", { required: true }),
    platformBranchName: core.getInput("platform_branch_name", {
      required: true,
    }),
    productionCNAME: core.getInput("production_cname", { required: true }),
    sourceBundlePath:
      core.getInput("source_bundle_path", { required: false }) || undefined,
    stagingCNAME:
      core.getInput("staging_cname", { required: false }) || undefined,
    swapCNAMES: core.getBooleanInput("swap_cnames", { required: true }),
    templateName:
      core.getInput("template_name", { required: false }) || undefined,
    terminateUnhealthyEnvironment: core.getBooleanInput(
      "terminate_unhealthy_environment",
      { required: true }
    ),
    versionLabel: core.getInput("version_label", { required: true }),
  };
}

export type ActionInputs = ReturnType<typeof getInputs>;

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
