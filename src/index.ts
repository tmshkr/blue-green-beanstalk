if (!process.env.GITHUB_ACTIONS) {
  require("dotenv").config();
}
import * as core from "@actions/core";
import { ElasticBeanstalkClient } from "@aws-sdk/client-elastic-beanstalk";
import { createEnvironment } from "./createEnvironment";

export const client = new ElasticBeanstalkClient({
  region: "us-west-2",
  // logger: console,
});

const appName = core.getInput("app_name", { required: true });
const blueEnv = core.getInput("blue_env", { required: true });
const greenEnv = core.getInput("green_env", { required: true });
const productionCNAME = core.getInput("production_cname", { required: true });
const stagingCNAME = core.getInput("staging_cname", { required: true });
const templateName = core.getInput("template_name", { required: true });

function getTargetEnv() {
  console.log({
    appName,
    blueEnv,
    greenEnv,
    productionCNAME,
    stagingCNAME,
    templateName,
  });
}

getTargetEnv();
