import { checkInputs } from "./inputs";
const { randomBytes } = require("node:crypto");

const region = "us-west-2";

describe("checkInputs", () => {
  const key = randomBytes(3).toString("hex");
  it("should throw an error when blueEnv and greenEnv are the same", () => {
    expect(() =>
      checkInputs({
        appName: `test-app-${key}`,
        awsRegion: region,
        blueEnv: `same-${key}`,
        deploy: true,
        greenEnv: `same-${key}`,
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        ports: [80],
        productionCNAME: `blue-green-test-${key}`,
        promote: true,
        sourceBundle: undefined,
        stagingCNAME: `blue-green-test-staging-${key}`,
        strategy: "swap_cnames",
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionDescription: undefined,
        versionLabel: `test-version-${key}`,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
        useDefaultOptionSettings: true,
      })
    ).toThrow("blue_env and green_env must be different");
  });

  it("should throw an error when productionCNAME and stagingCNAME are the same", () => {
    expect(() =>
      checkInputs({
        appName: `test-app-${key}`,
        awsRegion: region,
        blueEnv: `my-blue-env-${key}`,
        deploy: true,
        greenEnv: `my-green-env-${key}`,
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        ports: [80],
        productionCNAME: `same-${key}`,
        promote: true,
        sourceBundle: undefined,
        stagingCNAME: `same-${key}`,
        strategy: "swap_cnames",
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        versionDescription: undefined,
        versionLabel: `test-version-${key}`,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
        useDefaultOptionSettings: true,
      })
    ).toThrow("production_cname and staging_cname must be different");
  });
});
