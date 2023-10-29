# blue-green-beanstalk

GitHub Action to automate deployment to blue/green environments on AWS Elastic Beanstalk.

The action will create the following resources:

- An Elastic Beanstalk application, if it doesn't already exist.
- An Elastic Beanstalk application version, if it doesn't already exist.
- An Elastic Beanstalk environment, if it doesn't already exist.
- An Application Load Balancer, if it doesn't already exist, when using the `shared_alb` strategy.

Based on the provided inputs, the action will determine which environment is the target environment, i.e., the environment to which a new application version should be deployed.

## Inputs/Outputs

See [action.yml](action.yml)

## Deployment Strategies

### `swap_cnames`

The `swap_cnames` strategy uses the value of the `production_cname` input to determine which environment is the production environment.

If neither the blue or green environments exist, it will create a new environment with the `production_cname` input. If the production environment already exists, the action will target the staging environment, creating it if it doesn't exist.

The action will then swap the CNAMEs of the staging and production environments if `promote` is set to true.

### `shared_alb`

The `shared_alb` strategy determines which environment is the production environment by finding the `elasticbeanstalk:environment-id` tags on the associated ALB target groups, which is automatically created by Elastic Beanstalk. If the target groups are not properly tagged, the action will fail.

If neither the blue or green environments exist, it will provision an Application Load Balancer to share between the environments, and then create the production environment. If the production environment already exists, the action will target the staging environment, creating it if it doesn't exist.

When `promote` is set to true, the action will update the default action for each listener on the ALB with a port provided in the `ports` input, so that is forwards to the target group associated with the target environment.

When specifying multiple ports, the action will forward to the target group associated with that port, or else the target group associated with the first port provided, if no target group is associated with the port. For example, if `80,443,3000` is provided as the input, and only ports 80 and 3000 have target groups, the action will forward ports 80 and 443 to the target group for port 80, and port 3000 to the target group for port 3000.

## Terminating Environments

If the action finds that the staging environment is in an unhealthy state, it will be terminated and recreated, unless `terminate_unhealthy_environment` is set to false. The environment should be configured to recreate any associated resources that are deleted during environment termination, so that they are available when it is recreated.

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
        run: echo ${{ github.ref_name }} > ENVIRONMENT && zip -r bundle.zip . -x '*.git*'
      - name: Deploy
        uses: tmshkr/blue-green-beanstalk@v2
        with:
          app_name: "test-app"
          aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_region: ${{ vars.AWS_REGION }}
          aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          blue_env: "my-blue-env"
          green_env: "my-green-env"
          platform_branch_name: "Docker running on 64bit Amazon Linux 2023"
          production_cname: "blue-green-beanstalk-prod" # must be available
          promote: ${{ github.ref_name == 'main' }}
          source_bundle: "bundle.zip"
          staging_cname: "blue-green-beanstalk-staging" # must be available
          strategy: "swap_cnames"
          version_description: "Deployed by ${{ github.triggering_actor }}"
          version_label: ${{ github.ref_name }}-${{ github.sha }}
```
