import {
  CreateApplicationVersionCommand,
  CreateStorageLocationCommand,
  DescribeApplicationVersionsCommand,
  ElasticBeanstalkClient,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
const fs = require("fs");

import { ActionInputs, getCredentials } from "./inputs";

export async function getApplicationVersion(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs
) {
  const { ApplicationVersions } = await client.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: inputs.appName,
      VersionLabels: [inputs.versionLabel],
    })
  );

  if (ApplicationVersions.length > 0) {
    console.log(`Application version ${inputs.versionLabel} already exists.`);
    return ApplicationVersions[0];
  }

  const newVersion = await createApplicationVersion(client, inputs);
  return newVersion;
}

async function createApplicationVersion(
  client: ElasticBeanstalkClient,
  inputs: ActionInputs
) {
  let SourceBundle;

  if (inputs.sourceBundlePath) {
    const { S3Bucket } = await client.send(
      new CreateStorageLocationCommand({})
    );
    const S3Key = `${inputs.appName}/${inputs.versionLabel.replace(
      /[^a-zA-Z0-9-_]/g,
      "-"
    )}.zip`;

    SourceBundle = { S3Bucket, S3Key };

    const s3 = new S3Client({
      region: inputs.awsRegion,
      credentials: getCredentials(),
    });

    const fileExists = await s3
      .send(
        new HeadObjectCommand({
          Bucket: S3Bucket,
          Key: S3Key,
        })
      )
      .then(() => true)
      .catch((error) => {
        if (error.name === "NotFound") {
          return false;
        }
        throw error;
      });

    if (!fileExists) {
      console.log(`Uploading ${S3Key} to S3...`);
      await s3.send(
        new PutObjectCommand({
          Bucket: S3Bucket,
          Key: S3Key,
          Body: fs.readFileSync(inputs.sourceBundlePath),
        })
      );
    }
  }

  const { ApplicationVersion } = await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: inputs.appName,
      AutoCreateApplication: true,
      VersionLabel: inputs.versionLabel,
      SourceBundle,
    })
  );

  return ApplicationVersion;
}
