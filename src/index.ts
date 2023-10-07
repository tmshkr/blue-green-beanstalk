if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}
import * as core from "@actions/core";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { deploy } from "./deploy";
import { swapCNAMES } from "./swapCNAMES";

const inputs = {
  appName: core.getInput("app_name", { required: true }),
  awsRegion: core.getInput("aws_region", { required: false }),
  awsAccessKeyId: core.getInput("aws_access_key_id", { required: false }),
  awsSecretAccessKey: core.getInput("aws_secret_access_key", {
    required: false,
  }),
  awsSessionToken: core.getInput("aws_session_token", { required: false }),
  blueEnv: core.getInput("blue_env", { required: true }),
  deploy: core.getBooleanInput("deploy", { required: true }),
  greenEnv: core.getInput("green_env", { required: true }),
  platformBranchName: core.getInput("platform_branch_name", {
    required: true,
  }),
  productionCNAME: core.getInput("production_cname", { required: true }),
  sourceBundlePath: core.getInput("source_bundle_path", { required: false }),
  stagingCNAME: core.getInput("staging_cname", { required: true }),
  swapCNAMES: core.getBooleanInput("swap_cnames", { required: true }),
  templateName: core.getInput("template_name", { required: false }),
  terminateUnhealthyEnvironment: core.getBooleanInput(
    "terminate_unhealthy_environment",
    { required: true }
  ),
  versionLabel: core.getInput("version_label", { required: true }),
  waitForCreateEnv: core.getBooleanInput("wait_for_create_env", {
    required: true,
  }),
};

export type ActionInputs = typeof inputs;

const credentials = {
  accessKeyId: inputs.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey:
    inputs.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: inputs.awsSessionToken || process.env.AWS_SESSION_TOKEN,
};
const hasCredentials = Boolean(
  (credentials.accessKeyId && credentials.secretAccessKey) ||
    credentials.sessionToken
);

export const client = new ElasticBeanstalkClient({
  region: inputs.awsRegion || process.env.AWS_REGION!,
  credentials: hasCredentials ? credentials : undefined,
});

const context = { didCreateEnv: false };

async function run(inputs: ActionInputs) {
  const applicationVersion = await getApplicationVersion(inputs);
  const targetEnv = await getTargetEnv(inputs, applicationVersion, context);

  if (inputs.deploy && !context.didCreateEnv) {
    await deploy(targetEnv, applicationVersion);
  }
  if (inputs.swapCNAMES) {
    await swapCNAMES(inputs);
  }
}

run(inputs);
