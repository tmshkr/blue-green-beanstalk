import { EnvironmentDescription } from "@aws-sdk/client-elastic-beanstalk";
import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";
import {
  DescribeAddressesCommand,
  DisassociateAddressCommand,
  EC2Client,
  ReleaseAddressCommand,
} from "@aws-sdk/client-ec2";

const asClient = new AutoScalingClient();
const ec2Client = new EC2Client();

export async function spinDownEnvironment(env: EnvironmentDescription) {
  const asg = await asClient
    .send(new DescribeAutoScalingGroupsCommand({}))
    .then(({ AutoScalingGroups }) => {
      return AutoScalingGroups.find((asg) =>
        asg.AutoScalingGroupName.startsWith(`awseb-${env.EnvironmentId}`)
      );
    });

  const eip = await ec2Client
    .send(
      new DescribeAddressesCommand({
        PublicIps: [env.EndpointURL],
      })
    )
    .then(({ Addresses }) => Addresses[0]);

  await ec2Client.send(
    new DisassociateAddressCommand({
      AssociationId: eip.AssociationId,
    })
  );
  await ec2Client.send(
    new ReleaseAddressCommand({ AllocationId: eip.AllocationId })
  );
  await asClient.send(
    new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: asg.AutoScalingGroupName,
      MinSize: 0,
      MaxSize: 0,
      DesiredCapacity: 0,
    })
  );
}
