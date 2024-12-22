import {
  ApplicationVersionDescription,
  CreateEnvironmentCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { ebClient } from "./clients";
import { ActionInputs } from "./inputs";
import { getEnvironments } from "./getEnvironments";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

async function getPlatformArn(platformBranchName: string) {
  if (!platformBranchName) {
    throw new Error(
      "platform_branch_name must be provided when creating a new environment"
    );
  }
  const { PlatformSummaryList } = await ebClient.send(
    new ListPlatformVersionsCommand({
      Filters: [
        {
          Type: "PlatformBranchName",
          Operator: "=",
          Values: [platformBranchName],
        },
      ],
      MaxRecords: 1,
    })
  );
  return PlatformSummaryList[0].PlatformArn;
}

export async function createEnvironment(
  inputs: ActionInputs,
  applicationVersion?: ApplicationVersionDescription
) {
  const { prodEnv, stagingEnv, singleEnv } = await getEnvironments(inputs);
  if (stagingEnv) {
    console.error("Staging environment already exists:", stagingEnv);
    throw new Error("Cannot create staging environment.");
  }
  if (singleEnv) {
    console.error("Environment already exists:", singleEnv);
    throw new Error("Cannot create environment.");
  }
  const defaultOptionSettings = [
    {
      Namespace: "aws:ec2:instances",
      OptionName: "InstanceTypes",
      Value: "t3.micro,t2.micro",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "EnvironmentType",
      Value: "SingleInstance",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "ServiceRole",
      Value: "service-role/aws-elasticbeanstalk-service-role",
    },
    {
      Namespace: "aws:autoscaling:launchconfiguration",
      OptionName: "DisableIMDSv1",
      Value: true,
    },
    {
      Namespace: "aws:autoscaling:launchconfiguration",
      OptionName: "IamInstanceProfile",
      Value: "aws-elasticbeanstalk-ec2-role",
    },
  ];

  const startTime = new Date();
  const newEnv = await ebClient.send(
    new CreateEnvironmentCommand({
      ApplicationName: inputs.app_name,
      CNAMEPrefix:
        inputs.single_env_cname ??
        (prodEnv ? inputs.staging_cname : inputs.production_cname),
      EnvironmentName:
        inputs.single_env ??
        (prodEnv?.EnvironmentName === inputs.blue_env
          ? inputs.green_env
          : inputs.blue_env),
      OptionSettings:
        inputs.option_settings ??
        (inputs.use_default_option_settings
          ? defaultOptionSettings
          : undefined),
      PlatformArn: await getPlatformArn(inputs.platform_branch_name),
      TemplateName: inputs.template_name,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );

  console.log(
    `Creating environment ${newEnv.EnvironmentId} ${newEnv.EnvironmentName}...`
  );

  if (!inputs.wait_for_deployment) {
    return newEnv;
  }

  const ac = new AbortController();
  const interval = setDescribeEventsInterval({
    environment: newEnv,
    inputs,
    startTime,
  });
  await waitUntilEnvironmentExists(
    {
      client: ebClient,
      maxWaitTime: 60 * 10,
      minDelay: 5,
      maxDelay: 30,
      abortSignal: ac.signal,
    },
    { EnvironmentIds: [newEnv.EnvironmentId] }
  );
  clearInterval(interval);
  return newEnv;
}
