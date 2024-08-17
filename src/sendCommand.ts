import { EnvironmentDescription } from "@aws-sdk/client-elastic-beanstalk";
import {
  Command,
  CommandStatus,
  SendCommandCommand,
  ListCommandsCommand,
} from "@aws-sdk/client-ssm";
import { ActionInputs } from "./inputs";
import { ssmClient } from "./clients";

/**
 * Sends a shell script command to an Elastic Beanstalk environment.
 * @param inputs - the inputs for the action.
 * @param targetEnv - the target environment to send the command to.
 */
export async function sendCommand(
  inputs: ActionInputs,
  targetEnv: EnvironmentDescription
): Promise<void> {
  if (!targetEnv) {
    throw new Error("No environment available to send command");
  }

  const { Command } = await ssmClient.send(
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

  if (inputs.wait_for_command) {
    await waitForCommand({ command: Command });
  }
}

/**
 * Waits for an SSM command to complete or fail.
 * @param command - the command to wait for.
 */
async function waitForCommand({ command }: { command: Command }) {
  while (
    command.Status === CommandStatus.PENDING ||
    command.Status === CommandStatus.IN_PROGRESS
  ) {
    const { CompletedCount, TargetCount } = command;
    const percentComplete = (CompletedCount / TargetCount) * 100;
    let msg = `Command status: ${command.Status}`;
    if (percentComplete) {
      msg += ` - ${CompletedCount}/${TargetCount} (${percentComplete.toPrecision(
        3
      )}%) completed...`;
    }
    console.log(msg);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    command = await ssmClient
      .send(new ListCommandsCommand({ CommandId: command.CommandId }))
      .then(({ Commands }) => {
        if (Commands && Commands.length > 0) {
          return Commands[0];
        }
        throw new Error("Command not found");
      });
  }

  if (command.Status === CommandStatus.SUCCESS) {
    console.log(`Command completed:`, command);
  } else {
    console.error(`Command failed:`, command);
    throw new Error("Command failed");
  }
}
