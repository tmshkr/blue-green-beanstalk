import {
  DescribeEnvironmentsCommand,
  ElasticBeanstalkClient,
} from "@aws-sdk/client-elastic-beanstalk";

import { main } from "./main";
import { ActionInputs } from "./inputs";

const inputs: ActionInputs = {
  appName: `test-app-${Date.now()}`,
  awsRegion: "us-west-2",
  blueEnv: `my-blue-env-${Date.now()}`,
  deploy: true,
  greenEnv: `my-green-env-${Date.now()}`,
  platformBranchName: "Docker running on 64bit Amazon Linux 2023",
  productionCNAME: `blue-green-test-${Date.now()}`,
  sourceBundlePath: undefined,
  stagingCNAME: undefined,
  swapCNAMES: true,
  templateName: undefined,
  terminateUnhealthyEnvironment: true,
  versionLabel: "v1",
};

const client = new ElasticBeanstalkClient({ region: inputs.awsRegion });

describe("checkInputs", () => {
  it("should reject with an error when blueEnv and greenEnv are the same", () => {
    expect(() =>
      main({
        ...inputs,
        blueEnv: "test",
        greenEnv: "test",
      })
    ).rejects.toThrow("blue_env and green_env must be different");
  });

  it("should reject with an error when productionCNAME and stagingCNAME are the same", () => {
    expect(() =>
      main({
        ...inputs,
        productionCNAME: "test",
        stagingCNAME: "test",
      })
    ).rejects.toThrow("production_cname and staging_cname must be different");
  });
});

describe("main", () => {
  it(
    "should create a new EB environment with correct inputs",
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
