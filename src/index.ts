if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}
import * as core from "@actions/core";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { getApplicationVersion } from "./getApplicationVersion";
import { getTargetEnv } from "./getTargetEnv";
import { deploy } from "./deploy";

const inputs = {
  appName: core.getInput("app_name", { required: true }),
  awsRegion: core.getInput("aws_region", { required: true }),
  blueEnv: core.getInput("blue_env", { required: true }),
  greenEnv: core.getInput("green_env", { required: true }),
  platformBranchName: core.getInput("platform_branch_name", {
    required: true,
  }),
  productionCNAME: core.getInput("production_cname", { required: true }),
  sourceBundlePath: core.getInput("source_bundle_path", { required: false }),
  stagingCNAME: core.getInput("staging_cname", { required: true }),
  templateName: core.getInput("template_name", { required: false }),
  versionLabel: core.getInput("version_label", { required: true }),
  waitForCreateEnv: core.getBooleanInput("wait_for_create_env", {
    required: true,
  }),
};

export type ActionInputs = typeof inputs;

export const client = new ElasticBeanstalkClient({
  region: inputs.awsRegion,
  // logger: console,
});

async function run(inputs: ActionInputs) {
  console.log({ inputs });
  const applicationVersion = await getApplicationVersion(inputs);
  console.log({ applicationVersion });
  const targetEnv = await getTargetEnv(inputs);
  console.log({ targetEnv });
  // deploy to the target environment
  await deploy(targetEnv, applicationVersion);
  // swap the CNAMEs
}

run(inputs);
