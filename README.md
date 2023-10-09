# blue-green-beanstalk

GitHub Action to automate deployment to Blue/Green environments on AWS Elastic Beanstalk.

The action will create the following resources:

- An Elastic Beanstalk application, if it doesn't already exist.
- An Elastic Beanstalk application version, if it doesn't already exist.
- An Elastic Beanstalk environment, if it doesn't already exist.

Based on the `app_name`, `blue_env`, `green_env`, and `production_cname` inputs, the action will determine which environment is the target environment, i.e., the environment to which a new application version should be deployed.

If neither the blue or green environments exist, it will create a new environment with the `production_cname` input. If the production environment already exists, the action will target the staging environment, or create it if it doesn't exist. If the staging environment is in an unhealthy state, it will be terminated and recreated, unless `terminate_unhealthy_environment` is set to false.

The action will then optionally swap the CNAMEs of the staging and production environments.

## Inputs

See (action.yml)[./action.yml].
