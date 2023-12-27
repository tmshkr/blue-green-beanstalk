import { checkInputs } from "./inputs";
import fs from "fs";

const region = "us-west-2";

beforeAll(() => {
  fs.writeFileSync("test.json", JSON.stringify({ test: "test" }));
});

describe("checkInputs", () => {
  it("should throw an error when AWS_REGION is not provided", () => {
    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: undefined,
        blueEnv: `my-blue-env`,
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: `my-green-env`,
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `prod-cname`,
        sourceBundle: undefined,
        stagingCNAME: `staging-cname`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: undefined,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("aws_region must be provided");
  });

  it("should throw an error when blueEnv and greenEnv are the same", () => {
    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: region,
        blueEnv: `same`,
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: `same`,
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `prod-cname`,
        sourceBundle: undefined,
        stagingCNAME: `staging-cname`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: undefined,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("blue_env and green_env must be different");
  });

  it("should throw an error when sourceBundle and versionLabel are not provided together", () => {
    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: region,
        blueEnv: "my-blue-env",
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: "my-green-env",
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `prod-cname`,
        sourceBundle: "bundle.zip",
        stagingCNAME: `staging-cname`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: undefined,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("source_bundle and version_label must be provided together");

    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: region,
        blueEnv: "my-blue-env",
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: "my-green-env",
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `prod-cname`,
        sourceBundle: undefined,
        stagingCNAME: `staging-cname`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: "test-version",
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("source_bundle and version_label must be provided together");
  });

  it("should throw an error when productionCNAME and stagingCNAME are the same", () => {
    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: region,
        blueEnv: `my-blue-env`,
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: `my-green-env`,
        optionSettings: undefined,
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `same`,
        sourceBundle: undefined,
        stagingCNAME: `same`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: undefined,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("production_cname and staging_cname must be different");
  });

  it("should throw an error when provided option settings are not a JSON array", () => {
    expect(() =>
      checkInputs({
        appName: `test-app`,
        awsRegion: region,
        blueEnv: `my-blue-env`,
        deploy: true,
        disableTerminationProtection: false,
        enableTerminationProtection: false,
        greenEnv: `my-green-env`,
        optionSettings: "test.json",
        platformBranchName: "Docker running on 64bit Amazon Linux 2023",
        prep: false,
        productionCNAME: `prod-cname`,
        sourceBundle: undefined,
        stagingCNAME: `staging-cname`,
        swapCNAMEs: true,
        templateName: undefined,
        terminateUnhealthyEnvironment: true,
        useDefaultOptionSettings: true,
        useSharedALB: false,
        versionDescription: undefined,
        versionLabel: undefined,
        waitForEnvironment: true,
        waitForDeployment: true,
        waitForTermination: true,
      })
    ).toThrow("option_settings must be an array");
  });
});

afterAll(() => {
  fs.unlinkSync("test.json");
});
