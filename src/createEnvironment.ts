import {
  ApplicationVersionDescription,
  CreateEnvironmentCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { ActionInputs, client } from "./index";
import { defaultOptionSettings } from "./config/defaultOptionSettings";
import { getEnvironments } from "./getEnvironments";
import { setDescribeEventsInterval } from "./setDescribeEventsInterval";

async function getPlatformArn(platformBranchName: string) {
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
  inputs: ActionInputs,
  applicationVersion: ApplicationVersionDescription
) {
  const { prodEnv } = await getEnvironments(inputs);

  const startTime = new Date();
  const newEnv = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: applicationVersion.ApplicationName,
      TemplateName: inputs.templateName || undefined,
      EnvironmentName:
        prodEnv?.EnvironmentName === inputs.blueEnv
          ? inputs.greenEnv
          : inputs.blueEnv,
      CNAMEPrefix: prodEnv ? inputs.stagingCNAME : inputs.productionCNAME,
      PlatformArn: await getPlatformArn(inputs.platformBranchName),
      OptionSettings: inputs.templateName ? undefined : defaultOptionSettings,
      VersionLabel: applicationVersion.VersionLabel,
    })
  );
  console.log(
    `Creating environment ${newEnv.EnvironmentId} ${newEnv.EnvironmentName}...`
  );

  const interval = setDescribeEventsInterval(newEnv.EnvironmentId, startTime);
  await waitUntilEnvironmentExists(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [newEnv.EnvironmentId] }
  );
  clearInterval(interval);
  return newEnv;
}
