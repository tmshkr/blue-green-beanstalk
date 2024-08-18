import { expect, beforeAll, it, afterAll, describe } from "vitest";
import { ActionInputs, checkInputs } from "./inputs";
import { writeFileSync, unlinkSync } from "fs";

const inputs: ActionInputs = {
  app_name: "test",
  aws_region: "us-west-2",
  blue_env: undefined,
  create_environment: true,
  deploy: false,
  disable_termination_protection: false,
  enable_termination_protection: false,
  green_env: undefined,
  minimum_health_color: 3,
  option_settings: undefined,
  platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
  production_cname: undefined,
  send_command: undefined,
  single_env: undefined,
  single_env_cname: undefined,
  source_bundle: undefined,
  staging_cname: undefined,
  swap_cnames: false,
  template_name: undefined,
  terminate_unhealthy_environment: false,
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

beforeAll(() => {
  writeFileSync("test.json", JSON.stringify({ test: "not an array" }));
});

describe("checkInputs", () => {
  it("should throw an error when AWS_REGION is not provided", () => {
    expect(() => checkInputs({ ...inputs, aws_region: undefined })).toThrow(
      "aws_region must be provided"
    );
  });

  it("should throw an error when sourceBundle and versionLabel are not provided together", () => {
    expect(() => checkInputs({ ...inputs, source_bundle: "test.zip" })).toThrow(
      "source_bundle must be provided with a version_label"
    );
  });

  it("should throw an error when provided option settings are not a JSON array", () => {
    expect(() =>
      checkInputs({ ...inputs, option_settings: "test.json" })
    ).toThrow("option_settings must be an array");
  });
  describe("single_env", () => {
    it("should throw an error when single_env and single_env_cname are not provided together", () => {
      expect(() =>
        checkInputs({
          ...inputs,
          single_env: "test",
          single_env_cname: undefined,
        })
      ).toThrow("single_env and single_env_cname must be provided together");
    });
  });

  describe("blue/green", () => {
    it("should throw an error when blueEnv and greenEnv are the same", () => {
      expect(() =>
        checkInputs({
          ...inputs,
          blue_env: "test",
          green_env: "test",
          production_cname: "foo",
          staging_cname: "bar",
        })
      ).toThrow("blue_env and green_env must be different");
    });

    it("should throw an error when productionCNAME and stagingCNAME are the same", () => {
      expect(() =>
        checkInputs({
          ...inputs,
          blue_env: "foo",
          green_env: "bar",
          production_cname: "test",
          staging_cname: "test",
        })
      ).toThrow("production_cname and staging_cname must be different");
    });
  });
});

afterAll(() => {
  unlinkSync("test.json");
});
