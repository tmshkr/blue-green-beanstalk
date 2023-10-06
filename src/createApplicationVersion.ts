import {
  CreateApplicationVersionCommand,
  CreateStorageLocationCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
const fs = require("fs");

import { client, ActionInputs } from "./index";

export async function createApplicationVersion(inputs: ActionInputs) {
  const { S3Bucket } = await client.send(new CreateStorageLocationCommand({}));
  const filename = inputs.versionLabel.replace(/[^a-zA-Z0-9-_]/g, "-");
  const S3Key = `${inputs.appName}/${filename}.zip`;
  const s3 = new S3Client({ region: inputs.awsRegion });

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

  const newAppVersion = await client.send(
    new CreateApplicationVersionCommand({
      ApplicationName: inputs.appName,
      AutoCreateApplication: true,
      VersionLabel: inputs.versionLabel,
      SourceBundle: {
        S3Bucket,
        S3Key,
      },
    })
  );
  console.log(newAppVersion);
}
