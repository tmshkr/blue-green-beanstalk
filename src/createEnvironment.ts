import {
  ApplicationVersionDescription,
  CreateEnvironmentCommand,
  DescribeEnvironmentResourcesCommand,
  EnvironmentDescription,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { ebClient } from "./clients";
import { ActionInputs, DeploymentStrategy } from "./inputs";
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
  const { prodEnv } = await getEnvironments(inputs);

  const startTime = new Date();
  let newEnv;

  switch (inputs.strategy) {
    case DeploymentStrategy.SharedALB:
      newEnv = await createSharedALBEnv(inputs, prodEnv, applicationVersion);
      break;
    case DeploymentStrategy.SwapCNAMEs:
      newEnv = await createSwapCNAMEsEnv(inputs, prodEnv, applicationVersion);
      break;

    default:
      throw new Error(`Invalid strategy: ${inputs.strategy}`);
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

async function createSharedALBEnv(
  inputs: ActionInputs,
  prodEnv?: EnvironmentDescription,
  applicationVersion?: ApplicationVersionDescription
) {
  const SharedLoadBalancer = {
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

async function createSwapCNAMEsEnv(
  inputs: ActionInputs,
  prodEnv?: EnvironmentDescription,
  applicationVersion?: ApplicationVersionDescription
) {
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
      TemplateName: inputs.templateName,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      CNAMEPrefix: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      PlatformArn: await getPlatformArn(inputs.platformBranchName),
      OptionSettings: inputs.optionSettings
        ? inputs.optionSettings
        : inputs.useDefaultOptionSettings
        ? defaultOptionSettings
        : undefined,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );
}
