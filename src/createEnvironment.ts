import {
  CreateEnvironmentCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { client } from "./index";
import { defaultOptionSettings } from "./config/defaultOptionSettings";
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

export async function createEnvironment({
  appName,
  cname,
  envName,
  platformBranchName,
  templateName,
  waitForCreateEnv = true,
}: {
  appName: string;
  cname: string;
  envName: string;
  platformBranchName: string;
  templateName?: string;
  waitForCreateEnv?: boolean;
}) {
  const startTime = new Date();
  const response = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: appName,
      TemplateName: templateName || undefined,
      EnvironmentName: envName,
      CNAMEPrefix: cname,
      PlatformArn: await getPlatformArn(platformBranchName),
      OptionSettings: templateName ? undefined : defaultOptionSettings,
    })
  );
  console.log(response);

  const interval = setDescribeEventsInterval(response.EnvironmentId, startTime);
  await waitUntilEnvironmentExists(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [response.EnvironmentId] }
  );
  clearInterval(interval);
}
