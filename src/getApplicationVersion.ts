import {
  CreateApplicationCommand,
  CreateApplicationVersionCommand,
  CreateStorageLocationCommand,
  DescribeApplicationVersionsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

import { ebClient, s3Client } from "./clients";
import { ActionInputs } from "./inputs";

export async function getApplicationVersion(inputs: ActionInputs) {
  if (!inputs.version_label) {
    await ebClient
      .send(new CreateApplicationCommand({ ApplicationName: inputs.app_name }))
      .catch((error) => {
        if (
          error.name === "InvalidParameterValue" &&
          error.message.includes("already exists")
        ) {
          console.log(`Application ${inputs.app_name} already exists.`);
        } else throw error;
      });
    return null;
  }

  const { ApplicationVersions } = await ebClient.send(
    new DescribeApplicationVersionsCommand({
      ApplicationName: inputs.app_name,
      VersionLabels: [inputs.version_label],
    })
  );
  // .catch((error) => {});

  if (ApplicationVersions.length > 0) {
    console.log(`Application version ${inputs.version_label} already exists.`);
    return ApplicationVersions[0];
  }

  return await createApplicationVersion(inputs);
}

function encodeRFC3986URIComponent(str: string) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

async function createApplicationVersion(inputs: ActionInputs) {
  let SourceBundle;

  if (inputs.source_bundle) {
    const { S3Bucket } = await ebClient.send(
      new CreateStorageLocationCommand({})
    );
    const S3Key = `${inputs.app_name}/${encodeRFC3986URIComponent(
      inputs.version_label
    )}.${inputs.source_bundle.split(".").pop()}`;

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
          Body: readFileSync(inputs.source_bundle),
        })
      );
    }
  }

  const { ApplicationVersion } = await ebClient.send(
    new CreateApplicationVersionCommand({
      ApplicationName: inputs.app_name,
      AutoCreateApplication: true,
      Description: inputs.version_description,
      SourceBundle,
      VersionLabel: inputs.version_label,
    })
  );

  return ApplicationVersion;
}
