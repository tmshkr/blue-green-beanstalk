import {
  DescribeEventsCommand,
  EnvironmentDescription,
  EventDescription,
  EventSeverity,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { ActionInputs } from "./inputs";
import styles from "ansi-styles";

export function setDescribeEventsInterval({
  environment,
  inputs,
  startTime = new Date(),
}: {
  environment: EnvironmentDescription;
  inputs: ActionInputs;
  startTime?: Date;
}): NodeJS.Timeout {
  return setInterval(async () => {
    let { Events } = await ebClient.send(
      new DescribeEventsCommand({
        EnvironmentId: environment.EnvironmentId,
        StartTime: startTime,
      })
    );

    Events = Events.filter((event) => event.EventDate > startTime);
    if (Events.length > 0) {
      startTime = Events[0].EventDate;
      for (const event of Events.reverse()) {
        log(inputs, event);
      }
    } else {
      console.log(".");
    }
  }, 10000);
}

function log(inputs: ActionInputs, event: EventDescription) {
  let color;
  switch (event.EnvironmentName) {
    case inputs.blue_env:
      color = styles.blue;
      break;
    case inputs.green_env:
      color = styles.green;
      break;
    case inputs.single_env:
      color = styles.magenta;
      break;
    default:
      break;
  }
  switch (event.Severity) {
    case EventSeverity.TRACE:
    case EventSeverity.DEBUG:
      color = styles.gray;
      break;
    case EventSeverity.WARN:
      color = styles.yellow;
      break;
    case EventSeverity.ERROR:
    case EventSeverity.FATAL:
      color = styles.red;
      break;
    default:
      break;
  }
  console.log(
    `${color.open}[${event.EnvironmentName}]: ${printUTCTime(
      event.EventDate
    )} ${event.Severity} ${event.Message}${color.close}`
  );
  if (
    event.Severity === EventSeverity.ERROR ||
    event.Severity === EventSeverity.FATAL
  ) {
    throw new Error(event.Message);
  }
}

function printUTCTime(date: Date) {
  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds()
  )}`;
}
