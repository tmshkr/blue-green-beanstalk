import { DescribeEventsCommand } from "@aws-sdk/client-elastic-beanstalk";
import { client } from "./index";

export function setDescribeEventsInterval(
  environmentId: string,
  startTime = new Date()
): NodeJS.Timeout {
  return setInterval(async () => {
    let { Events } = await client.send(
      new DescribeEventsCommand({
        EnvironmentId: environmentId,
        StartTime: startTime,
      })
    );

    Events = Events.filter((event) => event.EventDate > startTime);
    if (Events.length > 0) {
      startTime = Events[0].EventDate;
      for (const e of Events.reverse()) {
        console.log(
          `${printUTCTime(e.EventDate)} ${e.Severity} ${e.EnvironmentName}: ${
            e.Message
          }`
        );
      }
    } else {
      console.log(".");
    }
  }, 10000);
}

function printUTCTime(date: Date) {
  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds()
  )}`;
}
