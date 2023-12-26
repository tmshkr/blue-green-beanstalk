import {
  ApplicationVersionDescription,
  CreateEnvironmentCommand,
  DescribeEnvironmentResourcesCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { ebClient } from "./clients";
import { ActionInputs } from "./inputs";
import { getEnvironments } from "./getEnvironments";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { createLoadBalancer } from "./createLoadBalancer";

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
  const startTime = new Date();
  let newEnv;

  if (inputs.useSharedALB) {
    newEnv = await createSharedALBEnv(inputs, applicationVersion);
  } else {
    newEnv = await createBasicEnv(inputs, applicationVersion);
  }

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

async function createBasicEnv(
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

  return await ebClient.send(
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
}

async function createSharedALBEnv(
  inputs: ActionInputs,
  applicationVersion?: ApplicationVersionDescription
) {
  const { prodEnv } = await getEnvironments(inputs);
  const SharedLoadBalancer = inputs.optionSettings?.find(
    (option) =>
      option.Namespace === "aws:elbv2:loadbalancer" &&
      option.OptionName === "SharedLoadBalancer"
  ) || {
    Namespace: "aws:elbv2:loadbalancer",
    OptionName: "SharedLoadBalancer",
    Value: prodEnv
      ? await ebClient
          .send(
            new DescribeEnvironmentResourcesCommand({
              EnvironmentId: prodEnv.EnvironmentId,
            })
          )
          .then(
            ({ EnvironmentResources }) =>
              EnvironmentResources.LoadBalancers[0].Name
          )
      : await createLoadBalancer(inputs).then(
          ({ LoadBalancerArn }) => LoadBalancerArn
        ),
  };

  const defaultOptionSettings = [
    {
      Namespace: "aws:ec2:instances",
      OptionName: "InstanceTypes",
      Value: "t3.micro,t2.micro",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "EnvironmentType",
      Value: "LoadBalanced",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "LoadBalancerType",
      Value: "application",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "LoadBalancerIsShared",
      Value: "true",
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
    SharedLoadBalancer,
  ];

  return await ebClient.send(
    new CreateEnvironmentCommand({
      ApplicationName: inputs.appName,
      TemplateName: inputs.templateName,
      CNAMEPrefix: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      PlatformArn: await getPlatformArn(inputs.platformBranchName),
      OptionSettings: inputs.optionSettings
        ? [...inputs.optionSettings, SharedLoadBalancer]
        : inputs.useDefaultOptionSettings
        ? defaultOptionSettings
        : undefined,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );
}
