import {
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { ebClient } from "./clients";
import { getEnvironments } from "./getEnvironments";

import { main } from "./main";
const { randomBytes } = require("node:crypto");

const region = "us-west-2";
jest.setTimeout(1000 * 60 * 10);

describe("shared_alb strategy", () => {
  const key = randomBytes(3).toString("hex");
  const inputs = {
    appName: `shared-alb-test-${key}`,
    awsRegion: region,
    blueEnv: `my-blue-env-${key}`,
    deploy: true,
    greenEnv: `my-green-env-${key}`,
    optionSettings: undefined,
    ports: [80],
    platformBranchName: "Docker running on 64bit Amazon Linux 2023",
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
    useDefaultOptionSettings: true,
  };

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
