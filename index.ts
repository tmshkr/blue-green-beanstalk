import {
  ElasticBeanstalkClient,
  CreateEnvironmentCommand,
  DescribeEventsCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

const client = new ElasticBeanstalkClient({ region: "us-west-2" });

const run = async () => {
  let startTime = new Date();
  const response = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: "foo-app",
      TemplateName: "single-instance",
      EnvironmentName: "blue-env",
      CNAMEPrefix: "bg-example-prod",
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
        console.log(e);
      }
    } else {
      console.log(".");
    }
  }, 5000);

  // TODO: promise should resolve when environment is ready
  await waitUntilEnvironmentExists(
    { client, maxWaitTime: 60 * 10 },
    { EnvironmentIds: [response.EnvironmentId] }
  );
  clearTimeout(interval);
};

run();
