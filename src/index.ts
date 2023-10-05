if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}
import * as core from "@actions/core";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { createEnvironment } from "./createEnvironment";

const appName = core.getInput("app_name", { required: true });
const awsRegion = core.getInput("aws_region", { required: true });
const blueEnv = core.getInput("blue_env", { required: true });
const greenEnv = core.getInput("green_env", { required: true });
const platformBranchName = core.getInput("platform_branch_name", {
  required: true,
});
const productionCNAME = core.getInput("production_cname", { required: true });
const stagingCNAME = core.getInput("staging_cname", { required: true });
const templateName = core.getInput("template_name", { required: true });
const waitForCreateEnv = core.getBooleanInput("wait_for_create_env", {
  required: true,
});

export const client = new ElasticBeanstalkClient({
  region: awsRegion,
  // logger: console,
});

async function getTargetEnv() {
  console.log({
    appName,
    awsRegion,
    blueEnv,
    greenEnv,
    productionCNAME,
    stagingCNAME,
    // templateName,
    waitForCreateEnv,
  });
  return greenEnv;
}
async function run() {
  const targetEnv = await getTargetEnv();
  await createEnvironment({
    appName,
    cname: stagingCNAME,
    envName: targetEnv,
    platformBranchName,
    // templateName,
    waitForCreateEnv,
  });
}

run();
