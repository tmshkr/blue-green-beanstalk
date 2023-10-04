import {
  ElasticBeanstalkClient,
  CreateEnvironmentCommand,
  DescribeEventsCommand,
  ListPlatformVersionsCommand,
  waitUntilEnvironmentExists,
} from "@aws-sdk/client-elastic-beanstalk";

const client = new ElasticBeanstalkClient({
  region: "us-west-2",
  // logger: console,
});

const creatEnvironment = async (envName: string) => {
  let startTime = new Date();
  const response = await client.send(
    new CreateEnvironmentCommand({
      ApplicationName: "foo-app",
      TemplateName: "single-instance",
      EnvironmentName: envName,
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
};

creatEnvironment("green-env");
