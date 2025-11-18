# GitHub Actions CI/CD – TurboVets App

This folder contains the CI/CD workflow for building, pushing, and deploying the TurboVets app using:

- Docker
- Amazon ECR
- Amazon ECS (Fargate)
- CDK for Terraform (CDKTF)
- Remote Terraform backend (S3 + DynamoDB) to manage the states
- HTTPS via ACM + ALB listener on port 443
- Domain name via Route53 domain

The main workflow file is:

- `.github/workflows/ci-cd.yml`

It is triggered on **push to `main`** and performs:

1. Build Docker image from `app/Dockerfile`
2. Push the image to Amazon ECR
3. Run CDKTF (`npx cdktf deploy`) from `iac/` to update the infrastructure
4. Roll out the new task definition to the ECS service

---

## 1. Required GitHub Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions → Secrets**:

| Secret name           | Description                                                  |
|-----------------------|--------------------------------------------------------------|
| `AWS_ACCESS_KEY_ID`   | Access key for the IAM user/role used by the pipeline       |
| `AWS_SECRET_ACCESS_KEY` | Secret key for the IAM user/role used by the pipeline     |

These keys must belong to an IAM principal with permissions to:

- Manage VPC/subnets/IGWs/route tables/security groups
- Manage ECS clusters/services/task definitions
- Manage ALB + target groups + listeners
- Read/write to the ECR repository used for the app
- Create and write to CloudWatch Logs
- Manage ECS task IAM roles (create, attach policies, pass role)
- Use remote Terraform backend (S3 + DynamoDB)
- Add HTTPS via ACM + ALB listener on port 443
- Add Route53 domain

> **Never** commit these keys into the repository – they live only as GitHub Secrets.

---

## 2. Required GitHub Repository Variables

Configure these in **GitHub → Settings → Secrets and variables → Actions → Variables**:

| Variable name        | Example value                | Description                                 |
|----------------------|------------------------------|---------------------------------------------|
| `AWS_REGION`         | `us-east-1`                  | AWS region for all resources                |
| `ENVIRONMENT`        | `dev`                        | Environment name (e.g. `dev`, `staging`)    |
| `SERVICE_NAME`       | `turbovets-app`              | Base service name used for resource naming  |
| `TF_LOCK_TABLE`      | `turbovets-terraform-locks`  | Name of the Dynamo lock table               |
| `TF_STATE_BUCKET`    | `turbovets-[unique-id...]`   | Unique S3 Bucket Name                       |
| `ENABLE_HTTPS`       | `false`                      | Enable HTTPS with ACM                       |
| `DOMAIN_NAME`        | `dev.marvinmeite.cloud `     | Domain name used to deploy the solution     |
| `HOSTED_ZONE_ID`     | `Z1234567890ABCDEFG`         | Route53 Hosted zone id                      |

The workflow reads them via `env:`:

```yaml
env:
  AWS_REGION: ${{ vars.AWS_REGION }}
  ENVIRONMENT: ${{ vars.ENVIRONMENT }}
  SERVICE_NAME: ${{ vars.SERVICE_NAME }}
  TF_LOCK_TABLE: ${{ vars.TF_LOCK_TABLE }}
  TF_STATE_BUCKET: ${{ vars.TF_STATE_BUCKET }}
  CONTAINER_PORT: "3000"
  ENABLE_HTTPS: ${{ vars.ENABLE_HTTPS }}
  DOMAIN_NAME: ${{ vars.DOMAIN_NAME }}
  HOSTED_ZONE_ID: ${{ vars.HOSTED_ZONE_ID }}
