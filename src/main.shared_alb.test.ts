import {
  DescribeEnvironmentsCommand,
  TerminateEnvironmentCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  DeleteLoadBalancerCommand,
  DescribeRulesCommand,
  LoadBalancer,
  Listener,
  Rule,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ebClient, elbv2Client } from "./clients";
import { getEnvironments } from "./getEnvironments";
import { createLoadBalancer } from "./test-utils/createLoadBalancer";

import { main } from "./main";
const { randomBytes } = require("node:crypto");
import fs from "fs";

jest.setTimeout(1000 * 60 * 10);

const key = randomBytes(3).toString("hex");
const inputs = {
  appName: `shared-alb-${key}`,
  awsRegion: "us-west-2",
  blueEnv: `my-blue-env-${key}`,
  createEnvironment: true,
  deploy: true,
  disableTerminationProtection: false,
  enableTerminationProtection: false,
  greenEnv: `my-green-env-${key}`,
  optionSettings: `option-settings-${key}.json`,
  platformBranchName: "Docker running on 64bit Amazon Linux 2023",
  productionCNAME: `shared-alb-prod-${key}`,
  promote: true,
  sourceBundle: undefined,
  stagingCNAME: `shared-alb-staging-${key}`,
  templateName: undefined,
  terminateUnhealthyEnvironment: true,
  updateEnvironment: true,
  updateListenerRules: true,
  versionDescription: undefined,
  versionLabel: undefined,
  waitForEnvironment: true,
  waitForDeployment: true,
  waitForTermination: true,
  useDefaultOptionSettings: false,
};

let alb: LoadBalancer;
let defaultListener: Listener;
let prodRule: Rule;
let stagingRule: Rule;
beforeAll(async () => {
  // create alb and listener rules
  await createLoadBalancer(inputs).then((res) => {
    alb = res.alb;
    defaultListener = res.defaultListener;
    prodRule = res.prodRule;
    stagingRule = res.stagingRule;
  });
  const optionSettings = [
    {
      Namespace: "aws:ec2:instances",
      OptionName: "InstanceTypes",
      Value: "t3.micro,t2.micro",
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
      OptionName: "IamInstanceProfile",
      Value: "aws-elasticbeanstalk-ec2-role",
    },
    {
      Namespace: "aws:elbv2:loadbalancer",
      OptionName: "SharedLoadBalancer",
      Value: alb.LoadBalancerArn,
    },
  ];

  fs.writeFileSync(
    `option-settings-${key}.json`,
    JSON.stringify(optionSettings)
  );
});

describe("updateListenerRules on SharedLoadBalancer", () => {
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
      const { stagingEnv, prodEnv } = await getEnvironments(inputs);
      expect(stagingEnv).toBeUndefined();
      expect(prodEnv.EnvironmentId).toEqual(Environments[0].EnvironmentId);
    });

    it("should update the tagged listener rule to point to the correct target group", async () => {
      const { Rules } = await elbv2Client.send(
        new DescribeRulesCommand({
          ListenerArn: defaultListener.ListenerArn,
        })
      );

      const prodTargetGroup = Rules.find((rule) =>
        rule.Conditions[0].Values[0].startsWith(inputs.productionCNAME)
      ).Actions[0].TargetGroupArn;

      expect(prodTargetGroup).toBeDefined();
      expect(
        Rules.find((rule) => rule.RuleArn === prodRule.RuleArn).Actions[0]
          .TargetGroupArn
      ).toEqual(prodTargetGroup);
    });
  });

  describe("create the staging envionment", () => {
    it("should have one environment", async () => {
      const { Environments } = await ebClient.send(
        new DescribeEnvironmentsCommand({
          ApplicationName: inputs.appName,
          EnvironmentNames: [inputs.blueEnv, inputs.greenEnv],
        })
      );
      expect(Environments).toHaveLength(1);
    });

    it("should create a new environment and then promote it to production", async () => {
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

      const { stagingEnv, prodEnv } = await getEnvironments(inputs);
      expect(stagingEnv.EnvironmentId).toEqual(oldEnv.EnvironmentId);
      expect(prodEnv.EnvironmentId).toEqual(newEnv.EnvironmentId);
    });

    it("should update both tagged listener rules to point to the correct target groups", async () => {
      const { Rules } = await elbv2Client.send(
        new DescribeRulesCommand({
          ListenerArn: defaultListener.ListenerArn,
        })
      );

      const prodTargetGroup = Rules.find((rule) =>
        rule.Conditions[0].Values[0].startsWith(inputs.productionCNAME)
      ).Actions[0].TargetGroupArn;
      const stagingTargetGroup = Rules.find((rule) =>
        rule.Conditions[0].Values[0].startsWith(inputs.stagingCNAME)
      ).Actions[0].TargetGroupArn;

      expect(prodTargetGroup).toBeDefined();
      expect(stagingTargetGroup).toBeDefined();

      expect(
        Rules.find((rule) => rule.RuleArn === prodRule.RuleArn).Actions[0]
          .TargetGroupArn
      ).toEqual(prodTargetGroup);

      expect(
        Rules.find((rule) => rule.RuleArn === stagingRule.RuleArn).Actions[0]
          .TargetGroupArn
      ).toEqual(stagingTargetGroup);
    });
  });
});

afterAll(async () => {
  await elbv2Client.send(
    new DeleteLoadBalancerCommand({ LoadBalancerArn: alb.LoadBalancerArn })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.blueEnv })
  );
  await ebClient.send(
    new TerminateEnvironmentCommand({ EnvironmentName: inputs.greenEnv })
  );
});
