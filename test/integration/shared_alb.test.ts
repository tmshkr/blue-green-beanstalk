import { expect, test, beforeAll, afterAll, suite, describe } from "vitest";
import {
  DescribeEnvironmentsCommand,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  AddTagsCommand,
  DescribeRulesCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { ebClient, elbv2Client, cfnClient } from "../../src/clients";
import { getEnvironments } from "../../src/getEnvironments";
import { ActionInputs } from "../../src/inputs";
import { main } from "../../src/main";
import { randomBytes } from "node:crypto";

const key = randomBytes(3).toString("hex");
const inputs: ActionInputs = {
  app_name: `shared-alb-${key}`,
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
  production_cname: `shared-alb-prod-${key}`,
  send_command: undefined,
  single_env: undefined,
  single_env_cname: undefined,
  source_bundle: undefined,
  staging_cname: `shared-alb-staging-${key}`,
  swap_cnames: true,
  template_name: undefined,
  terminate_unhealthy_environment: true,
  update_environment: true,
  update_listener_rules: true,
  update_listener_rules_cname: "true",
  version_description: undefined,
  version_label: undefined,
  wait_for_command: true,
  wait_for_environment: true,
  wait_for_deployment: true,
  wait_for_termination: true,
  use_default_option_settings: false,
};

const prodDomain = `${inputs.production_cname}.${inputs.aws_region}.elasticbeanstalk.com`;
const stagingDomain = `${inputs.staging_cname}.${inputs.aws_region}.elasticbeanstalk.com`;

const cfnImports = {
  TestSharedLoadBalancerArn: "",
  TestDefaultListenerArn: "",
  TestProdListenerRuleArn: "",
  TestPublicSubnets: "",
  TestStagingListenerRuleArn: "",
  TestVpcId: "",
};

beforeAll(async () => {
  const { Stacks } = await cfnClient.send(
    new DescribeStacksCommand({ StackName: "TestAlbStack" })
  );

  if (!Stacks || !Stacks[0]) {
    throw new Error("Test stack not found");
  }

  const { Outputs } = Stacks[0];
  for (const { ExportName, OutputValue } of Outputs!) {
    cfnImports[ExportName as keyof typeof cfnImports] = OutputValue!;
  }
  for (const key in cfnImports) {
    if (!cfnImports[key]) {
      throw new Error(`Missing CfnImport: [${key}]`);
    }
  }

  await elbv2Client.send(
    new AddTagsCommand({
      ResourceArns: [cfnImports.TestProdListenerRuleArn],
      Tags: [
        {
          Key: "bluegreenbeanstalk:target_cname",
          Value: inputs.production_cname,
        },
      ],
    })
  );

  await elbv2Client.send(
    new AddTagsCommand({
      ResourceArns: [cfnImports.TestStagingListenerRuleArn],
      Tags: [
        {
          Key: "bluegreenbeanstalk:target_cname",
          Value: inputs.staging_cname,
        },
      ],
    })
  );

  inputs.option_settings = [
    {
      Namespace: "aws:ec2:instances",
      OptionName: "InstanceTypes",
      Value: "t3.micro,t2.micro",
    },
    {
      Namespace: "aws:ec2:vpc",
      OptionName: "VPCId",
      Value: cfnImports.TestVpcId,
    },
    {
      Namespace: "aws:ec2:vpc",
      OptionName: "Subnets",
      Value: cfnImports.TestPublicSubnets,
    },
    {
      Namespace: "aws:ec2:vpc",
      OptionName: "ELBSubnets",
      Value: cfnImports.TestPublicSubnets,
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "EnvironmentType",
      Value: "LoadBalanced",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "LoadBalancerType",
      Value: "application",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "LoadBalancerIsShared",
      Value: "true",
    },
    {
      Namespace: "aws:elasticbeanstalk:environment",
      OptionName: "ServiceRole",
      Value: "service-role/aws-elasticbeanstalk-service-role",
    },
    {
      Namespace: "aws:autoscaling:launchconfiguration",
      OptionName: "DisableIMDSv1",
      Value: true,
    },
    {
      Namespace: "aws:autoscaling:launchconfiguration",
      OptionName: "IamInstanceProfile",
      Value: "aws-elasticbeanstalk-ec2-role",
    },
    {
      Namespace: "aws:elbv2:loadbalancer",
      OptionName: "SharedLoadBalancer",
      Value: cfnImports.TestSharedLoadBalancerArn,
    },
  ];
});

suite(
  "main SharedLoadBalancer test",
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
        const { stagingEnv, prodEnv } = await getEnvironments(inputs);
        expect(stagingEnv).toBeUndefined();
        expect(prodEnv!.EnvironmentId).toEqual(Environments![0].EnvironmentId);
      });

      test("should update the tagged listener rule to point to the correct target group", async () => {
        const { Rules } = await elbv2Client.send(
          new DescribeRulesCommand({
            ListenerArn: cfnImports.TestDefaultListenerArn,
          })
        );

        let prodTargetGroup: string | undefined;
        let testProdRuleTG: string | undefined;
        for (const { Conditions, Actions, RuleArn } of Rules!) {
          const { TargetGroupArn } = Actions![0];
          if (RuleArn === cfnImports.TestProdListenerRuleArn) {
            testProdRuleTG = TargetGroupArn;
          } else {
            for (const { HostHeaderConfig } of Conditions!) {
              if (HostHeaderConfig?.Values!.includes(prodDomain)) {
                prodTargetGroup = TargetGroupArn;
              }
            }
          }
        }

        expect(prodTargetGroup).toBeDefined();
        expect(testProdRuleTG).toBeDefined();
        expect(testProdRuleTG).toEqual(prodTargetGroup);
      });
    });

    describe("create the staging envionment", () => {
      test("should have one environment", async () => {
        const { Environments } = await ebClient.send(
          new DescribeEnvironmentsCommand({
            ApplicationName: inputs.app_name,
            EnvironmentNames: [inputs.blue_env, inputs.green_env],
          })
        );
        expect(Environments).toHaveLength(1);
      });

      test("should create a new environment and then swap the CNAMEs", async () => {
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

        const { stagingEnv, prodEnv } = await getEnvironments(inputs);
        expect(stagingEnv!.EnvironmentId).toEqual(oldEnv.EnvironmentId);
        expect(prodEnv!.EnvironmentId).toEqual(newEnv.EnvironmentId);
      });

      test("should update both tagged listener rules to point to the correct target groups", async () => {
        const { Rules } = await elbv2Client.send(
          new DescribeRulesCommand({
            ListenerArn: cfnImports.TestDefaultListenerArn,
          })
        );

        let prodTargetGroup: string | undefined;
        let stagingTargetGroup: string | undefined;
        let testProdRuleTG: string | undefined;
        let testStagingRuleTG: string | undefined;
        for (const { Conditions, Actions, RuleArn } of Rules!) {
          const { TargetGroupArn } = Actions![0];
          if (RuleArn === cfnImports.TestProdListenerRuleArn) {
            testProdRuleTG = TargetGroupArn;
          } else if (RuleArn === cfnImports.TestStagingListenerRuleArn) {
            testStagingRuleTG = TargetGroupArn;
          } else {
            for (const { HostHeaderConfig } of Conditions!) {
              if (HostHeaderConfig?.Values!.includes(prodDomain)) {
                prodTargetGroup = TargetGroupArn;
              } else if (HostHeaderConfig?.Values!.includes(stagingDomain)) {
                stagingTargetGroup = TargetGroupArn;
              }
            }
          }
        }

        expect(prodTargetGroup).toBeDefined();
        expect(stagingTargetGroup).toBeDefined();
        expect(testProdRuleTG).toBeDefined();
        expect(testStagingRuleTG).toBeDefined();

        expect(testProdRuleTG).toEqual(prodTargetGroup);
        expect(testStagingRuleTG).toEqual(stagingTargetGroup);
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
