import { S3Backend } from "cdktf";
import { TerraformStack } from "cdktf";
import * as path from "path";

export function configureBackend(stack: TerraformStack) {
  const env = process.env.ENVIRONMENT ?? "dev";
  const bucket = process.env.TF_STATE_BUCKET!;
  const table = process.env.TF_LOCK_TABLE!;

  if (!bucket || !table) {
    throw new Error("TF_STATE_BUCKET and TF_LOCK_TABLE must be set.");
  }

  new S3Backend(stack, {
    bucket,
    key: `${env}/terraform.tfstate`,
    region: process.env.AWS_REGION ?? "us-east-1",
    dynamodbTable: table,
    encrypt: true
  });
}
