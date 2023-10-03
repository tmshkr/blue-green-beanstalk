import {
  ElasticBeanstalkClient,
  ListPlatformVersionsCommand,
} from "@aws-sdk/client-elastic-beanstalk";

const client = new ElasticBeanstalkClient({ region: "us-west-2" });

const run = async () => {
  const command = new ListPlatformVersionsCommand({
    Filters: [
      {
        Type: "PlatformBranchName",
        Operator: "=",
        Values: ["Docker running on 64bit Amazon Linux 2023"],
      },
    ],
  });
  const response = await client.send(command);
  console.log(response);
};

run();
