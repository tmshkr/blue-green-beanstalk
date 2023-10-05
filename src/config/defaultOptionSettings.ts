export const defaultOptionSettings = [
  {
    Namespace: "aws:elasticbeanstalk:environment",
    OptionName: "EnvironmentType",
    Value: "SingleInstance",
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
];
