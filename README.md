# blue-green-beanstalk

GitHub Action to automate deployment to Blue/Green environments on AWS Elastic Beanstalk.

The action will create the following resources:

- An Elastic Beanstalk application, if it doesn't already exist.
- An Elastic Beanstalk application version, if it doesn't already exist.
- An Elastic Beanstalk environment, if it doesn't already exist.

Based on the `app_name`, `blue_env`, `green_env`, and `production_cname` inputs, the action will determine which environment is the target environment, i.e., the environment to which a new application version should be deployed.

If neither the blue or green environments exist, it will create a new environment with the `production_cname` input. If the production environment already exists, the action will target the staging environment, or create it if it doesn't exist. If the staging environment is in an unhealthy state, it will be terminated and recreated, unless `terminate_unhealthy_environment` is set to false.

The action will then optionally swap the CNAMEs of the staging and production environments.

## Inputs/Outputs

See [action.yml](action.yml)

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
        uses: tmshkr/blue-green-beanstalk@v1
        with:
          app_name: "test-app"
          aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_region: ${{ vars.AWS_REGION }}
          aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          blue_env: "my-blue-env"
          green_env: "my-green-env"
          platform_branch_name: "Docker running on 64bit Amazon Linux 2023"
          production_cname: "your-unique-cname"
          source_bundle: "bundle.zip"
          swap_cnames: ${{ github.ref_name == 'main' }}
          version_description: "Deployed by ${{ github.actor }}"
          version_label: ${{ github.ref_name }}-${{ github.sha }}
```
