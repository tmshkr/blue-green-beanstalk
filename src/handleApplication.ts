import {
  CreateApplicationCommand,
  DescribeApplicationsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { client, ActionInputs } from "./index";

export async function handleApplication(inputs: ActionInputs) {
  const { Applications } = await client.send(
    new DescribeApplicationsCommand({ ApplicationNames: [inputs.appName] })
  );

  if (!Applications.length) {
    console.log(`Creating application ${inputs.appName}`);
    const res = await client.send(
      new CreateApplicationCommand({
        ApplicationName: inputs.appName,
        Description: `Created by blue-green-beanstalk`,
      })
    );
  }
}
