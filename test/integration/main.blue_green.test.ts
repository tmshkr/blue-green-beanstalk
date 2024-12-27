import { expect, test, afterAll, suite, describe } from "vitest";
import {
  DescribeEnvironmentsCommand,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { ActionInputs } from "../../src/inputs";
import { ebClient } from "../../src/clients";
import { main } from "../../src/main";
import { spinDownEnvironment } from "../../src/test-utils/spinDownEnvironment";
import { randomBytes } from "node:crypto";

const key = randomBytes(3).toString("hex");
const inputs: ActionInputs = {
  app_name: `test-app-${key}`,
  aws_region: "us-west-2",
  blue_env: `my-blue-env-${key}`,
  create_environment: true,
  deploy: true,
  disable_termination_protection: false,
  enable_termination_protection: false,
  green_env: `my-green-env-${key}`,
  minimum_health_color: 3,
  option_settings: undefined,
  platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
  production_cname: `blue-green-test-prod-${key}`,
  send_command: undefined,
  single_env: undefined,
  single_env_cname: undefined,
  source_bundle: undefined,
  staging_cname: `blue-green-test-staging-${key}`,
  swap_cnames: true,
  template_name: undefined,
  terminate_unhealthy_environment: true,
  update_environment: true,
  update_listener_rules: false,
  update_listener_rules_cname: "false",
  use_default_option_settings: true,
  version_description: undefined,
  version_label: undefined,
  wait_for_command: true,
  wait_for_environment: true,
  wait_for_deployment: true,
  wait_for_termination: true,
};
const prodDomain = `${inputs.production_cname}.${inputs.aws_region}.elasticbeanstalk.com`;
const stagingDomain = `${inputs.staging_cname}.${inputs.aws_region}.elasticbeanstalk.com`;

suite(
  "main blue/green test",
  { concurrent: false, timeout: 1000 * 60 * 10, sequential: true },
  () => {
    describe("create the production environment", () => {
      test("should not have any environments", async () => {
        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.app_name,
            EnvironmentNames: [inputs.blue_env, inputs.green_env],
          })
        );
        expect(Environments).toHaveLength(0);
      });

      test("should create a new production EB environment", async () => {
        await main(inputs);

        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.app_name,
            EnvironmentNames: [inputs.blue_env, inputs.green_env],
          })
        );

        expect(Environments).toHaveLength(1);
        expect(Environments![0].CNAME).toEqual(prodDomain);
      });
    });

    describe("create the staging envionment", () => {
      test("should have one environment with the production domain", async () => {
        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.app_name,
            EnvironmentNames: [inputs.blue_env, inputs.green_env],
          })
        );
        expect(Environments).toHaveLength(1);
        expect(Environments![0].CNAME).toEqual(prodDomain);
      });

      // TODOL it should send the command to the target environment and execute it

      test("should create a new environment and then swap the CNAMES", async () => {
        await main(inputs);

        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.app_name,
            EnvironmentNames: [inputs.blue_env, inputs.green_env],
          })
        );

        Environments!.sort(
          (a, b) => a.DateCreated!.valueOf() - b.DateCreated!.valueOf()
        );
        expect(Environments).toHaveLength(2);
        const oldEnv = Environments![0];
        const newEnv = Environments![1];

        expect(oldEnv.CNAME).toEqual(stagingDomain);
        expect(newEnv.CNAME).toEqual(prodDomain);
      });
    });

    describe("setup unhealthy environment", () => {
      test("should spin down the staging environment so that its health is Grey", async () => {
        const stagingEnv = await ebClient
          .send(
            new DescribeEnvironmentsCommand({
              ApplicationName: inputs.app_name,
              EnvironmentNames: [inputs.blue_env, inputs.green_env],
            })
          )
          .then(({ Environments }) =>
            Environments!.find((env) => env.CNAME === stagingDomain)
          );

        let health = stagingEnv!.Health;
        if (health !== "Grey") {
          await spinDownEnvironment(stagingEnv!);

          let times = 0;
          while (times < 10) {
            times++;
            health = await ebClient
              .send(
                new DescribeEnvironmentsCommand({
                  EnvironmentIds: [stagingEnv!.EnvironmentId!],
                })
              )
              .then(({ Environments }) => {
                return Environments![0].Health;
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
      test("should not terminate the environment when terminate_unhealthy_environment is set to false", async () => {
        try {
          await main({
            ...inputs,
            terminate_unhealthy_environment: false,
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
      test("should not wait for the environment to terminate when wait_for_termination is set to false", async () => {
        try {
          await main({
            ...inputs,
            terminate_unhealthy_environment: true,
            wait_for_termination: false,
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
  }
);

afterAll(async () => {
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.blue_env })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.green_env })
  );
});
