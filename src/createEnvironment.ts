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
  const { prodEnv } = await getEnvironments(inputs);
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
      OptionName: "IamInstanceProfile",
      Value: "aws-elasticbeanstalk-ec2-role",
    },
  ];

  const startTime = new Date();
  const newEnv = await ebClient.send(
    new CreateEnvironmentCommand({
      ApplicationName: inputs.appName,
      CNAMEPrefix: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      OptionSettings: inputs.optionSettings
        ? inputs.optionSettings
        : inputs.useDefaultOptionSettings
        ? defaultOptionSettings
        : undefined,
      PlatformArn: await getPlatformArn(inputs.platformBranchName),
      TemplateName: inputs.templateName,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );

  console.log(
    `Creating environment ${newEnv.EnvironmentId} ${newEnv.EnvironmentName}...`
  );

  if (!inputs.waitForDeployment) {
    return newEnv;
  }

  const interval = setDescribeEventsInterval(newEnv.EnvironmentId, startTime);
  await waitUntilEnvironmentExists(
    { client: ebClient, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [newEnv.EnvironmentId] }
  );
  clearInterval(interval);
  return newEnv;
}
