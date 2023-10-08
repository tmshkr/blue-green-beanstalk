import {
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
} from "@aws-sdk/client-elastic-beanstalk";

import { main } from "./main";
const { randomBytes } = require("node:crypto");

const client = new ElasticBeanstalkClient({ region: "us-west-2" });

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
        sourceBundlePath: undefined,
        stagingCNAME: `blue-green-test-staging-${key}`,
        swapCNAMES: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionLabel: `test-version-${key}`,
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
        sourceBundlePath: undefined,
        stagingCNAME: `same-${key}`,
        swapCNAMES: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionLabel: `test-version-${key}`,
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
    productionCNAME: `blue-green-test-${key}`,
    sourceBundlePath: undefined,
    stagingCNAME: `blue-green-test-staging-${key}`,
    swapCNAMES: true,
    templateName: undefined,
    terminateUnhealthyEnvironment: true,
    versionLabel: `test-version-${key}`,
  };

  describe("no production environment exists", () => {
    it(
      "should create a new production EB environment when none exists",
      async () => {
        const preTest = await client.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(preTest.Environments).toHaveLength(0);
        await main(inputs);

        const postTest = await client.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(postTest.Environments).toHaveLength(1);
        expect(postTest.Environments[0].CNAME).toEqual(
          `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
        );
      },
      1000 * 60 * 10
    );
  });

  describe("production environment already exists", () => {
    it(
      "should create a new staging EB environment and then swap the CNAMES",
      async () => {
        const preTest = await client.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(preTest.Environments).toHaveLength(1);
        const oldEnv = preTest.Environments[0];

        await main(inputs);

        const postTest = await client.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.appName,
            EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
          })
        );

        expect(postTest.Environments).toHaveLength(2);

        expect(
          postTest.Environments.find(
            (env) => env.EnvironmentName === oldEnv.EnvironmentName
          ).CNAME
        ).toEqual(
          `${inputs.stagingCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
        );

        expect(
          postTest.Environments.find(
            (env) => env.EnvironmentName !== oldEnv.EnvironmentName
          ).CNAME
        ).toEqual(
          `${inputs.productionCNAME}.${inputs.awsRegion}.elasticbeanstalk.com`
        );
      },
      1000 * 60 * 10
    );
  });
});
