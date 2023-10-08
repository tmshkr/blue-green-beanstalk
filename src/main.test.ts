import { main } from "./main";
import { ActionInputs } from "./inputs";

const inputs: ActionInputs = {
  appName: "my-app",
  awsRegion: "us-west-2",
  blueEnv: "my-blue-env",
  deploy: true,
  greenEnv: "my-green-env",
  platformBranchName: "Docker running on 64bit Amazon Linux 2023",
  productionCNAME: "blue-green-test",
  sourceBundlePath: "bundle.zip",
  stagingCNAME: "",
  swapCNAMES: true,
  templateName: "",
  terminateUnhealthyEnvironment: true,
  versionLabel: "v1",
};

describe("Action Inputs", () => {
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
