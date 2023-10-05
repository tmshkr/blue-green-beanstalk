if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}
import * as core from "@actions/core";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { getTargetEnv } from "./getTargetEnv";
import { handleApplication } from "./handleApplication";

const inputs = {
  appName: core.getInput("app_name", { required: true }),
  awsRegion: core.getInput("aws_region", { required: true }),
  blueEnv: core.getInput("blue_env", { required: true }),
  greenEnv: core.getInput("green_env", { required: true }),
  platformBranchName: core.getInput("platform_branch_name", {
    required: true,
  }),
  productionCNAME: core.getInput("production_cname", { required: true }),
  stagingCNAME: core.getInput("staging_cname", { required: true }),
  templateName: core.getInput("template_name", { required: false }),
  waitForCreateEnv: core.getBooleanInput("wait_for_create_env", {
    required: true,
  }),
};

export type ActionInputs = typeof inputs;

export const client = new ElasticBeanstalkClient({
  region: inputs.awsRegion,
  // logger: console,
});

async function run() {
  console.log({ inputs });
  await handleApplication(inputs);
  const targetEnv = await getTargetEnv(inputs);
  console.log({ targetEnv });
}

run();
