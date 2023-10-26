import {
  ApplicationVersionDescription,
  CreateEnvironmentCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { ActionInputs, DeploymentStrategy } from "./inputs";
import { getEnvironments } from "./getEnvironments";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";
import { createLoadBalancer } from "./createLoadBalancer";

async function getPlatformArn(
  client: ElasticBeanstalkClient,
  platformBranchName: string
) {
  const { PlatformSummaryList } = await client.send(
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
  client: ElasticBeanstalkClient,
  inputs: ActionInputs,
  applicationVersion?: ApplicationVersionDescription
) {
  const { prodEnv } = await getEnvironments(client, inputs);

  const startTime = new Date();
  let newEnv;

  switch (inputs.strategy) {
    case DeploymentStrategy.SharedALB:
      newEnv = await createSharedALBEnv(
        client,
        inputs,
        prodEnv,
        applicationVersion
      );
      break;
    case DeploymentStrategy.SwapCNAMEs:
      newEnv = await createSwapCNAMEsEnv(
        client,
        inputs,
        prodEnv,
        applicationVersion
      );
      break;

    default:
      throw new Error(`Invalid strategy: ${inputs.strategy}`);
  }

  console.log(
    `Creating environment ${newEnv.EnvironmentId} ${newEnv.EnvironmentName}...`
  );

  if (!inputs.waitForEnvironment) {
    return newEnv;
  }

  const interval = setDescribeEventsInterval(
    client,
    newEnv.EnvironmentId,
    startTime
  );
  await waitUntilEnvironmentExists(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [newEnv.EnvironmentId] }
  );
  clearInterval(interval);
  return newEnv;
}

async function createSharedALBEnv(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs,
  prodEnv?: EnvironmentDescription,
  applicationVersion?: ApplicationVersionDescription
) {
  const { LoadBalancerArn } = await createLoadBalancer(inputs);
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
      Namespace: "aws:elbv2:loadbalancer",
      OptionName: "SharedLoadBalancer",
      Value: LoadBalancerArn,
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

  return await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: inputs.appName,
      TemplateName: inputs.templateName,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      PlatformArn: await getPlatformArn(client, inputs.platformBranchName),
      OptionSettings: inputs.useDefaultOptionSettings
        ? defaultOptionSettings
        : undefined,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );
}

async function createSwapCNAMEsEnv(
  client: ElasticBeanstalkClient,
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

  return await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: inputs.appName,
      TemplateName: inputs.templateName,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      CNAMEPrefix: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      PlatformArn: await getPlatformArn(client, inputs.platformBranchName),
      OptionSettings: inputs.useDefaultOptionSettings
        ? defaultOptionSettings
        : undefined,
      VersionLabel: applicationVersion?.VersionLabel,
    })
  );
}
