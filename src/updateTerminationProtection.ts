import { UpdateTerminationProtectionCommand } from "@aws-sdk/client-cloudformation";
import { EnvironmentDescription } from "@aws-sdk/client-elastic-beanstalk";
import { cfnClient } from "./clients";

export async function enableTerminationProtection(
  targetEnv: EnvironmentDescription
) {
  if (!targetEnv) {
    throw new Error(
      "No target environment found. Cannot enable termination protection."
    );
  }
  const stackName = `awseb-${targetEnv.EnvironmentId}-stack`;
  console.log(
    `[${targetEnv.EnvironmentName}]: Enabling termination protection for stack ${stackName}...`
  );
  await cfnClient.send(
    new UpdateTerminationProtectionCommand({
      EnableTerminationProtection: true,
      StackName: stackName,
    })
  );
}

export async function disableTerminationProtection(
  targetEnv: EnvironmentDescription
) {
  const stackName = `awseb-${targetEnv.EnvironmentId}-stack`;
  console.log(
    `[${targetEnv.EnvironmentName}]: Disabling termination protection for stack ${stackName}...`
  );
  await cfnClient.send(
    new UpdateTerminationProtectionCommand({
      EnableTerminationProtection: false,
      StackName: stackName,
    })
  );
}
