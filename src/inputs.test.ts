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
        app_name: `test-app`,
        aws_region: undefined,
        blue_env: `my-blue-env`,
        deploy: true,
        disable_termination_protection: false,
        enable_termination_protection: false,
        green_env: `my-green-env`,
        minimum_health_color: 3,
        option_settings: undefined,
        platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
        create_environment: true,
        production_cname: `prod-cname`,
        send_command: undefined,
        single_env: undefined,
        single_env_cname: undefined,
        source_bundle: undefined,
        staging_cname: `staging-cname`,
        swap_cnames: true,
        template_name: undefined,
        terminate_unhealthy_environment: true,
        update_environment: true,
        update_listener_rules: false,
        update_listener_rules_env_name: "false",
        use_default_option_settings: true,
        version_description: undefined,
        version_label: undefined,
        wait_for_command: true,
        wait_for_environment: true,
        wait_for_deployment: true,
        wait_for_termination: true,
      })
    ).toThrow("aws_region must be provided");
  });

  it("should throw an error when blueEnv and greenEnv are the same", () => {
    expect(() =>
      checkInputs({
        app_name: `test-app`,
        aws_region: region,
        blue_env: `same`,
        deploy: true,
        disable_termination_protection: false,
        enable_termination_protection: false,
        green_env: `same`,
        option_settings: undefined,
        minimum_health_color: 3,
        platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
        create_environment: true,
        production_cname: `prod-cname`,
        send_command: undefined,
        single_env: undefined,
        single_env_cname: undefined,
        source_bundle: undefined,
        staging_cname: `staging-cname`,
        swap_cnames: true,
        template_name: undefined,
        terminate_unhealthy_environment: true,
        update_environment: true,
        update_listener_rules: false,
        update_listener_rules_env_name: "false",
        use_default_option_settings: true,
        version_description: undefined,
        version_label: undefined,
        wait_for_command: true,
        wait_for_environment: true,
        wait_for_deployment: true,
        wait_for_termination: true,
      })
    ).toThrow("blue_env and green_env must be different");
  });

  it("should throw an error when sourceBundle and versionLabel are not provided together", () => {
    expect(() =>
      checkInputs({
        app_name: `test-app`,
        aws_region: region,
        blue_env: "my-blue-env",
        deploy: true,
        disable_termination_protection: false,
        enable_termination_protection: false,
        green_env: "my-green-env",
        option_settings: undefined,
        minimum_health_color: 3,
        platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
        create_environment: true,
        production_cname: `prod-cname`,
        send_command: undefined,
        source_bundle: "bundle.zip",
        single_env: undefined,
        single_env_cname: undefined,
        staging_cname: `staging-cname`,
        swap_cnames: true,
        template_name: undefined,
        terminate_unhealthy_environment: true,
        update_environment: true,
        update_listener_rules: false,
        update_listener_rules_env_name: "false",
        use_default_option_settings: true,
        version_description: undefined,
        version_label: undefined,
        wait_for_command: true,
        wait_for_environment: true,
        wait_for_deployment: true,
        wait_for_termination: true,
      })
    ).toThrow("source_bundle must be provided with a version_label");
  });

  it("should throw an error when productionCNAME and stagingCNAME are the same", () => {
    expect(() =>
      checkInputs({
        app_name: `test-app`,
        aws_region: region,
        blue_env: `my-blue-env`,
        create_environment: true,
        deploy: true,
        disable_termination_protection: false,
        enable_termination_protection: false,
        green_env: `my-green-env`,
        option_settings: undefined,
        minimum_health_color: 3,
        platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
        production_cname: `same`,
        send_command: undefined,
        single_env: undefined,
        single_env_cname: undefined,
        source_bundle: undefined,
        staging_cname: `same`,
        swap_cnames: true,
        template_name: undefined,
        terminate_unhealthy_environment: true,
        update_environment: true,
        update_listener_rules: false,
        update_listener_rules_env_name: "false",
        use_default_option_settings: true,
        version_description: undefined,
        version_label: undefined,
        wait_for_command: true,
        wait_for_environment: true,
        wait_for_deployment: true,
        wait_for_termination: true,
      })
    ).toThrow("production_cname and staging_cname must be different");
  });

  it("should throw an error when provided option settings are not a JSON array", () => {
    expect(() =>
      checkInputs({
        app_name: `test-app`,
        aws_region: region,
        blue_env: `my-blue-env`,
        create_environment: true,
        deploy: true,
        disable_termination_protection: false,
        enable_termination_protection: false,
        green_env: `my-green-env`,
        minimum_health_color: 3,
        option_settings: "test.json",
        platform_branch_name: "Docker running on 64bit Amazon Linux 2023",
        production_cname: `prod-cname`,
        send_command: undefined,
        single_env: undefined,
        single_env_cname: undefined,
        source_bundle: undefined,
        staging_cname: `staging-cname`,
        swap_cnames: true,
        template_name: undefined,
        terminate_unhealthy_environment: true,
        update_environment: true,
        update_listener_rules: false,
        update_listener_rules_env_name: "false",
        use_default_option_settings: true,
        version_description: undefined,
        version_label: undefined,
        wait_for_environment: true,
        wait_for_command: true,
        wait_for_deployment: true,
        wait_for_termination: true,
      })
    ).toThrow("option_settings must be an array");
  });
});

afterAll(() => {
  fs.unlinkSync("test.json");
});
