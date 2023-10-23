import {
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
  EnvironmentDescription,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";
import {
  DisassociateAddressCommand,
  EC2Client,
  ReleaseAddressCommand,
} from "@aws-sdk/client-ec2";

import { main } from "./main";
const { randomBytes } = require("node:crypto");

const asClient = new AutoScalingClient();
const ebClient = new ElasticBeanstalkClient();
const ec2Client = new EC2Client();

describe("checkInputs", () => {
  const key = randomBytes(4).toString("hex");
  it("should reject with an error when blueEnv and greenEnv are the same", () => {
    expect(() =>
      main({
        appName: `test-app-${key}`,
        awsRegion: "us-west-2",
        blueEnv: `same-${key}`,
        deploy: true,
        greenEnv: `same-${key}`,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        productionCNAME: `blue-green-test-${key}`,
        sourceBundle: undefined,
        stagingCNAME: `blue-green-test-staging-${key}`,
        swapCNAMES: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionDescription: undefined,
        versionLabel: `test-version-${key}`,
        waitForEnvironment: true,
      })
    ).rejects.toThrow("blue_env and green_env must be different");
  });

  it("should reject with an error when productionCNAME and stagingCNAME are the same", () => {
    expect(() =>
      main({
        appName: `test-app-${key}`,
        awsRegion: "us-west-2",
        blueEnv: `my-blue-env-${key}`,
        deploy: true,
        greenEnv: `my-green-env-${key}`,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        productionCNAME: `same-${key}`,
        sourceBundle: undefined,
        stagingCNAME: `same-${key}`,
        swapCNAMES: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionDescription: undefined,
        versionLabel: `test-version-${key}`,
        waitForEnvironment: true,
      })
    ).rejects.toThrow("production_cname and staging_cname must be different");
  });
});

describe("main", () => {
  const key = randomBytes(4).toString("hex");
  const inputs = {
    appName: `test-app-${key}`,
    awsRegion: "us-west-2",
    blueEnv: `my-blue-env-${key}`,
    deploy: true,
    greenEnv: `my-green-env-${key}`,
    platformBranchName: "Docker running on 64bit Amazon Linux 2023",
    productionCNAME: `blue-green-test-prod-${key}`,
    sourceBundle: undefined,
    stagingCNAME: `blue-green-test-staging-${key}`,
    swapCNAMES: true,
    templateName: undefined,
    terminateUnhealthyEnvironment: true,
    versionDescription: undefined,
    versionLabel: `test-version-${key}`,
    waitForEnvironment: true,
  };
  const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
  const stagingDomain = `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;

  describe("blue/green environments do not exist", () => {
    it("should not have any environments", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments).toHaveLength(0);
    });

    it(
      "should create a new production EB environment",
      async () => {
        await main(inputs);

        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(Environments).toHaveLength(1);
        expect(Environments[0].CNAME).toEqual(prodDomain);
      },
      1000 * 60 * 10
    );
  });

  describe("only production environment exists", () => {
    it("should have one environment with the production domain", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments[0]).toHaveLength(1);
      expect(Environments[0]).toEqual(prodDomain);
    });

    it(
      "should create a new staging EB environment and then swap the CNAMES",
      async () => {
        await main(inputs);

        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(Environments).toHaveLength(2);
        const oldEnv = Environments[0];
        const newEnv = Environments[1];

        expect(oldEnv.CNAME).toEqual(stagingDomain);
        expect(newEnv.CNAME).toEqual(prodDomain);
      },
      1000 * 60 * 10
    );
  });

  describe("staging environment unhealthy", () => {
    it("should spin down the staging environment so that its health status is Grey", async () => {
      const stagingEnv = await ebClient
        .send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        )
        .then(({ Environments }) =>
          Environments.find((env) => env.CNAME === inputs.stagingCNAME)
        );

      await spinDownEnvironment(stagingEnv);

      await ebClient
        .send(
          new DescribeEnvironmentsCommand({
            EnvironmentIds: [stagingEnv.EnvironmentId],
          })
        )
        .then(({ Environments }) => {
          expect(Environments[0].Health === "Grey");
        });
    });

    it("should not terminate the environment when terminate_unhealthy_environment is set to false", async () => {
      await main({ ...inputs, terminateUnhealthyEnvironment: false });
      const stagingEnv = await ebClient
        .send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        )
        .then(({ Environments }) => {
          return Environments.find((env) => env.CNAME === inputs.stagingCNAME);
        });
      expect(stagingEnv.Status).toEqual("Ready");
    });
    it("should not wait for the environment to be healthy when wait_for_environment is set to false", async () => {
      expect(await main({ ...inputs, waitForEnvironment: false })).toBe(1);
    });
  });
});

async function spinDownEnvironment(env: EnvironmentDescription) {
  const asg = await asClient
    .send(new DescribeAutoScalingGroupsCommand({}))
    .then(({ AutoScalingGroups }) => {
      return AutoScalingGroups.find((asg) =>
        asg.AutoScalingGroupName.startsWith(`awseb-${env.EnvironmentId}`)
      );
    });

  await ec2Client.send(
    new DisassociateAddressCommand({
      PublicIp: env.EndpointURL,
    })
  );
  await ec2Client.send(
    new ReleaseAddressCommand({ PublicIp: env.EndpointURL })
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
