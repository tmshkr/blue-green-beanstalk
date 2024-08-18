import {
  aws_elasticloadbalancingv2 as elbv2,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class TestAlbStack extends Stack {
  alb: elbv2.ApplicationLoadBalancer;
  albSecurityGroup: ec2.SecurityGroup;
  defaultListener: elbv2.ApplicationListener;
  prodListenerRule: elbv2.ApplicationListenerRule;
  stagingListenerRule: elbv2.ApplicationListenerRule;
  vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    this.exportValue(this.vpc.vpcId, { name: "TestVpcId" });
    this.exportValue(
      this.vpc.publicSubnets.map(({ subnetId }) => subnetId).join(","),
      {
        name: "TestPublicSubnets",
      }
    );

    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      allowAllOutbound: true,
      securityGroupName: "AlbSecurityGroup",
      vpc: this.vpc,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic from anywhere"
    );

    this.alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: this.albSecurityGroup,
      vpc: this.vpc,
    });

    this.exportValue(this.alb.loadBalancerArn, {
      name: "TestSharedLoadBalancerArn",
    });

    this.defaultListener = this.alb.addListener("HttpListener", {
      open: true,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(200, {
        contentType: "text/plain",
        messageBody: "Hello, World!",
      }),
    });

    this.exportValue(this.defaultListener.listenerArn, {
      name: "TestDefaultListenerArn",
    });

    this.prodListenerRule = new elbv2.ApplicationListenerRule(
      this,
      "TestProdListenerRule",
      {
        listener: this.defaultListener,
        priority: 1,
        action: elbv2.ListenerAction.fixedResponse(200, {
          contentType: "text/plain",
          messageBody: "Hello, Prod!",
        }),
        conditions: [elbv2.ListenerCondition.pathPatterns(["/prod"])],
      }
    );

    this.exportValue(this.prodListenerRule.listenerRuleArn, {
      name: "TestProdListenerRuleArn",
    });

    this.stagingListenerRule = new elbv2.ApplicationListenerRule(
      this,
      "TestStagingListenerRule",
      {
        listener: this.defaultListener,
        priority: 2,
        action: elbv2.ListenerAction.fixedResponse(200, {
          contentType: "text/plain",
          messageBody: "Hello, Staging!",
        }),
        conditions: [elbv2.ListenerCondition.pathPatterns(["/staging"])],
      }
    );

    this.exportValue(this.stagingListenerRule.listenerRuleArn, {
      name: "TestStagingListenerRuleArn",
    });
  }
}
