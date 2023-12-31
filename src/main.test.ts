import {
  DescribeEnvironmentsCommand,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";

import { ebClient } from "./clients";
import { main } from "./main";
import { spinDownEnvironment } from "./test-utils/spinDownEnvironment";
const { randomBytes } = require("node:crypto");

const key = randomBytes(3).toString("hex");
const inputs = {
  appName: `test-app-${key}`,
  awsRegion: "us-west-2",
  blueEnv: `my-blue-env-${key}`,
  createEnvironment: true,
  deploy: true,
  disableTerminationProtection: false,
  enableTerminationProtection: false,
  greenEnv: `my-green-env-${key}`,
  optionSettings: undefined,
  platformBranchName: "Docker running on 64bit Amazon Linux 2023",
  productionCNAME: `blue-green-test-prod-${key}`,
  sourceBundle: undefined,
  stagingCNAME: `blue-green-test-staging-${key}`,
  swapCNAMEs: true,
  templateName: undefined,
  terminateUnhealthyEnvironment: true,
  updateEnvironment: true,
  updateListenerRules: false,
  useDefaultOptionSettings: true,
  versionDescription: undefined,
  versionLabel: undefined,
  waitForEnvironment: true,
  waitForDeployment: true,
  waitForTermination: true,
};
const prodDomain = `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;
const stagingDomain = `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`;

jest.setTimeout(1000 * 60 * 10);
describe("main test", () => {
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
      expect(Environments[0].CNAME).toEqual(prodDomain);
    });
  });

  describe("create the staging envionment", () => {
    it("should have one environment with the production domain", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments).toHaveLength(1);
      expect(Environments[0].CNAME).toEqual(prodDomain);
    });

    it("should create a new environment and then swap the CNAMES", async () => {
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

      expect(oldEnv.CNAME).toEqual(stagingDomain);
      expect(newEnv.CNAME).toEqual(prodDomain);
    });
  });

  describe("setup unhealthy environment", () => {
    it("should spin down the staging environment so that its health is Grey", async () => {
      const stagingEnv = await ebClient
        .send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        )
        .then(({ Environments }) =>
          Environments.find((env) => env.CNAME === stagingDomain)
        );

      let health = stagingEnv.Health;
      if (health !== "Grey") {
        await spinDownEnvironment(stagingEnv);

        let times = 0;
        while (times < 10) {
          times++;
          health = await ebClient
            .send(
              new DescribeEnvironmentsCommand({
                EnvironmentIds: [stagingEnv.EnvironmentId],
              })
            )
            .then(({ Environments }) => {
              return Environments[0].Health;
            });

          if (health === "Grey") {
            break;
          } else {
            console.log("Waiting for health to update...");
            await new Promise((resolve) => setTimeout(resolve, 1000 * 30));
          }
        }
      }

      expect(health).toEqual("Grey");
    });
  });

  describe("terminate_unhealthy_environment", () => {
    it("should not terminate the environment when terminate_unhealthy_environment is set to false", async () => {
      try {
        await main({
          ...inputs,
          terminateUnhealthyEnvironment: false,
          deploy: false,
        });
        throw new Error("Should not reach here");
      } catch (err) {
        expect(err.message).toEqual(
          "Target environment is unhealthy and terminate_unhealthy_environment is false. Exiting..."
        );
      }
    });
  });

  describe("wait_for_termination", () => {
    it("should not wait for the environment to terminate when wait_for_termination is set to false", async () => {
      try {
        await main({
          ...inputs,
          terminateUnhealthyEnvironment: true,
          waitForTermination: false,
          deploy: false,
        });
        throw new Error("Should not reach here");
      } catch (err) {
        expect(err.message).toEqual(
          "Target environment is terminating and wait_for_termination is false. Exiting..."
        );
      }
    });
  });
});

afterAll(async () => {
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.blueEnv })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.greenEnv })
  );
});
