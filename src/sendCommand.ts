import { EnvironmentDescription } from "@aws-sdk/client-elastic-beanstalk";
import { SendCommandCommand } from "@aws-sdk/client-ssm";
import { ActionInputs } from "./inputs";
import { ssmClient } from "./clients";

export async function sendCommand(
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription
): Promise<void> {
  if (!targetEnv) {
    throw new Error("No environment available to send command");
  }

  const response = await ssmClient.send(
    new SendCommandCommand({
      Targets: [
        {
          Key: "tag:elasticbeanstalk:environment-id",
          Values: [targetEnv.EnvironmentId],
        },
      ],
      DocumentName: "AWS-RunShellScript",
      Parameters: {
        workingDirectory: ["/var/app/current"],
        executionTimeout: ["3600"],
        commands: inputs.send_command.split("\n"),
      },
      TimeoutSeconds: 600,
    })
  );
  console.log(response);
}
