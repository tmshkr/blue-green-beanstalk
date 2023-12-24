import {
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { DeleteLoadBalancerCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { ebClient, elbClient } from "./clients";
import { getEnvironments } from "./getEnvironments";

import { main } from "./main";
const { randomBytes } = require("node:crypto");

jest.setTimeout(1000 * 60 * 10);

const key = randomBytes(3).toString("hex");
const inputs = {
  appName: `shared-alb-test-${key}`,
  awsRegion: "us-west-2",
  blueEnv: `my-blue-env-${key}`,
  deploy: true,
  disableTerminationProtection: false,
  enableTerminationProtection: false,
  greenEnv: `my-green-env-${key}`,
  optionSettings: undefined,
  ports: [80],
  platformBranchName: "Docker running on 64bit Amazon Linux 2023",
  prep: false,
  productionCNAME: undefined,
  promote: true,
  sourceBundle: undefined,
  stagingCNAME: undefined,
  strategy: "shared_alb",
  templateName: undefined,
  terminateUnhealthyEnvironment: true,
  versionDescription: undefined,
  versionLabel: `test-version-${key}`,
  waitForEnvironment: true,
  waitForDeployment: true,
  waitForTermination: true,
  useDefaultOptionSettings: true,
};

describe("shared_alb strategy", () => {
  describe("create the production environment", () => {
    it("should not have any environments", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments).toHaveLength(0);
    });

    it("should create a new production EB environment", async () => {
      await main(inputs);

      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );

      expect(Environments).toHaveLength(1);
      const { stagingEnv, prodEnv } = await getEnvironments(inputs);
      expect(stagingEnv).toBeUndefined();
      expect(prodEnv.EnvironmentId).toEqual(Environments[0].EnvironmentId);
    });
  });

  describe("create the staging envionment", () => {
    it("should have one environment with an ALB", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments).toHaveLength(1);

      await ebClient
        .send(
          new DescribeEnvironmentResourcesCommand({
            EnvironmentId: Environments[0].EnvironmentId,
          })
        )
        .then(({ EnvironmentResources }) => {
          expect(EnvironmentResources.LoadBalancers).toHaveLength(1);
        });
    });

    it("should create a new environment and then promote it to production", async () => {
      await main(inputs);

      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );

      Environments.sort(
        (a, b) => a.DateCreated.valueOf() - b.DateCreated.valueOf()
      );
      expect(Environments).toHaveLength(2);
      const oldEnv = Environments[0];
      const newEnv = Environments[1];

      const { stagingEnv, prodEnv } = await getEnvironments(inputs);
      expect(stagingEnv.EnvironmentId).toEqual(oldEnv.EnvironmentId);
      expect(prodEnv.EnvironmentId).toEqual(newEnv.EnvironmentId);
    });
  });
});

afterAll(async () => {
  const loadBalancerArn = await ebClient
    .send(
      new DescribeEnvironmentResourcesCommand({
        EnvironmentName: inputs.blueEnv,
      })
    )
    .then(({ EnvironmentResources }) => {
      expect(EnvironmentResources.LoadBalancers).toHaveLength(1);
      return EnvironmentResources.LoadBalancers[0].Name;
    });
  await elbClient.send(
    new DeleteLoadBalancerCommand({ LoadBalancerArn: loadBalancerArn })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.blueEnv })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.greenEnv })
  );
});
