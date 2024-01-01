import {
  CreateApplicationCommand,
  CreateApplicationVersionCommand,
  CreateStorageLocationCommand,
  DescribeApplicationVersionsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
const fs = require("fs");

import { ebClient, s3Client } from "./clients";
import { ActionInputs } from "./inputs";

export async function getApplicationVersion(inputs: ActionInputs) {
  if (!inputs.versionLabel) {
    await ebClient
      .send(new CreateApplicationCommand({ ApplicationName: inputs.appName }))
      .catch((error) => {
        if (
          error.name === "InvalidParameterValue" &&
          error.message.includes("already exists")
        ) {
          console.log(`Application ${inputs.appName} already exists.`);
        } else throw error;
      });
    return null;
  }

  const { ApplicationVersions } = await ebClient.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: inputs.appName,
      VersionLabels: [inputs.versionLabel],
    })
  );

  if (ApplicationVersions.length > 0) {
    console.log(`Application version ${inputs.versionLabel} already exists.`);
    return ApplicationVersions[0];
  }

  return await createApplicationVersion(inputs);
}

async function createApplicationVersion(inputs: ActionInputs) {
  let SourceBundle;

  if (inputs.sourceBundle) {
    const { S3Bucket } = await ebClient.send(
      new CreateStorageLocationCommand({})
    );
    const S3Key = `${inputs.appName}/${inputs.versionLabel.replace(
      /[^a-zA-Z0-9-_]/g,
      "-"
    )}.zip`;

    SourceBundle = { S3Bucket, S3Key };

    const fileExists = await s3Client
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
      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3Bucket,
          Key: S3Key,
          Body: fs.readFileSync(inputs.sourceBundle),
        })
      );
    }
  }

  const { ApplicationVersion } = await ebClient.send(
    new CreateApplicationVersionCommand({
      ApplicationName: inputs.appName,
      AutoCreateApplication: true,
      Description: inputs.versionDescription,
      SourceBundle,
      VersionLabel: inputs.versionLabel,
    })
  );

  return ApplicationVersion;
}
