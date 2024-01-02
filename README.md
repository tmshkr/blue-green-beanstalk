# blue-green-beanstalk

GitHub Action to automate deployment to blue/green environments on AWS Elastic Beanstalk.

The action will create the following resources:

- An Elastic Beanstalk application, if it doesn't already exist.
- An Elastic Beanstalk application version, if it doesn't already exist.
- An Elastic Beanstalk environment, if it doesn't already exist.

Based on the provided inputs, the action will determine which environment is the target environment, to which a new application version should be deployed.

The action uses the values of the `production_cname` and `staging_cname` inputs to determine which environment is the production or staging environment. Accordingly, the `production_cname` and `staging_cname` inputs should be set to the CNAME prefix of the production and staging environments, respectively.

If neither environment exists, it will create a new environment with the `production_cname` input. If the production environment already exists, the action will target the staging environment, creating it if it doesn't exist.

After deploying, the action will swap the CNAMEs of the staging and production environments, if `swap_cnames` is set to true.

## Inputs/Outputs

See [action.yml](action.yml)

## Terminating Environments

If the action finds that the target environment is in an unhealthy state, it will be terminated and recreated, unless `terminate_unhealthy_environment` is set to false. The environment should be configured to recreate any associated resources that are deleted during environment termination, so that they are available when it is recreated.

The action will also enable or disable termination protection on the target environment's underlying CloudFormation stack, if `enable_termination_protection` or `disable_termination_protection` are set to true, respectively.

## Usage

See the [example repo](https://github.com/tmshkr/blue-green-beanstalk-example) for an example of how to use this action.

```yaml
name: Example Deploy Workflow
  on:
    workflow_dispatch:
    push:
      branches:
        - main
        - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Generate source bundle
        run: zip -r bundle.zip . -x '*.git*'
      - name: Deploy
        uses: tmshkr/blue-green-beanstalk@v4
        with:
          app_name: "test-app"
          aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_region: ${{ vars.AWS_REGION }}
          aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          blue_env: "my-blue-env"
          deploy: true
          green_env: "my-green-env"
          platform_branch_name: "Docker running on 64bit Amazon Linux 2023"
          production_cname: "blue-green-beanstalk-prod"
          source_bundle: "bundle.zip"
          swap_cnames: ${{ github.ref_name == 'main' }}
          staging_cname: "blue-green-beanstalk-staging"
          version_description: ${{ github.event.head_commit.message }}
          version_label: ${{ github.ref_name }}-${{ github.sha }}
```

### Using a Shared Load Balancer

When using a [shared load balancer](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/environments-cfg-alb-shared.html), the `update_listener_rules` input can be set to true, so that the action will update any listener rules that are tagged with a `bluegreenbeanstalk:target_cname` key, whose value is equal to the `production_cname` or `staging_cname` input, so that the listener rule will be updated to point to the same target group as the CNAME.

If using a process on a port besides the default port 80, set another tag on the listener rule with a `bluegreenbeanstalk:target_port` key and a value equal to the port number, so that the listener rule forwards to the target group on that port.
