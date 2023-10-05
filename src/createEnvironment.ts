import {
  CreateEnvironmentCommand,
  DescribeEventsCommand,
  ListPlatformVersionsCommand,
  ListAvailableSolutionStacksCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

import { client } from "./index";
import { defaultOptionSettings } from "./config/defaultOptionSettings";

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
  waitForCreateEnv,
}: {
  appName: string;
  cname: string;
  envName: string;
  platformBranchName: string;
  templateName?: string;
  waitForCreateEnv: boolean;
}) {
  let startTime = new Date();
  const response = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: appName,
      TemplateName: templateName,
      EnvironmentName: envName,
      CNAMEPrefix: cname,
      PlatformArn: await getPlatformArn(platformBranchName),
      OptionSettings: templateName ? undefined : defaultOptionSettings,
    })
  );
  console.log(response);

  const interval = setInterval(async () => {
    let { Events } = await client.send(
      new DescribeEventsCommand({
        EnvironmentId: response.EnvironmentId,
        StartTime: startTime,
      })
    );

    Events = Events.filter((event) => event.EventDate > startTime);
    if (Events.length > 0) {
      startTime = Events[0].EventDate;
      for (const e of Events.reverse()) {
        console.log(
          `${e.EventDate.toISOString()} - ${e.Severity} - ${e.Message}`
        );
      }
    } else {
      console.log(".");
    }
  }, 5000);

  await waitUntilEnvironmentExists(
    { client, maxWaitTime: 60 * 10, minDelay: 5, maxDelay: 30 },
    { EnvironmentIds: [response.EnvironmentId] }
  );
  clearInterval(interval);
}
