# GitHub Actions CI/CD Pipeline – TurboVets App

This folder defines the full CI/CD pipeline used to build, publish, and deploy the TurboVets application across **multiple AWS environments** (`dev`, `staging`, `prod`).
The pipeline is implemented using:

* **GitHub Actions**
* **Docker** for image packaging
* **Amazon ECR** for image storage
* **Amazon ECS (Fargate)** for compute
* **CDK for Terraform (CDKTF)** for infrastructure-as-code
* **S3 + DynamoDB** for Terraform remote state
* **ALB + ACM + Route53** for optional HTTPS and custom domains

The main workflow is:

```
.github/workflows/ci-cd.yml
```

# 1 Create the Remote Terraform backend (S3 + DynamoDB)

### If it’s not already executed:
> **Run once per environment locally** before commiting on the `main` branch.

From the **project root**:

Login on AWS cli: 
```bash
aws configure sso
# SSO session name: turbovets-assessment
# SSO start URL: https://yourcompany.awsapps.com/start # Choose the right user associated with the environment AWS Console → IAM Identity Center → Settings
# SSO region: us-east-1
```
or `aws configure`: quicker for this project, but it's less secure

```bash
cd remote_tf_s3_dynamo_db_state_backend
cp .env.example .env
```

Edit `.env` to override defaults, and source your variables in the command line:

```bash
set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting

# Verify the variables
printenv | grep -E '^(TF_STATE_BUCKET|TF_LOCK_TABLE)='
```

```bash
chmod +x create_backend.sh
./create_backend.sh
```

This workflow performs **two separate jobs**, depending on how it is triggered:

---


# 2. Overview of Pipeline Triggers

### Trigger A — `push` to `main`

This initiates the **build pipeline**:

1. Builds the Docker image from `app/Dockerfile`
2. Tags the image using the commit SHA (`GITHUB_SHA`)
3. Pushes it to the ECR repository
4. Deploy the solution in DEV

This ensures that every commit to `main` produces an immutable image stored in AWS.

#### Check Fargate logs since 1 day

```bash
aws logs tail /ecs/${ECR_REPOSITORY}${ENVIRONMENT} \
  --since 1d \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

---

### Trigger B — Manual deployment (`workflow_dispatch`)

This initiates the **deployment pipeline** and requires choosing an environment:

```
dev | staging | prod
```

This job:

1. Retrieves the ECR image matching the commit SHA
2. Injects all environment-specific variables into CDKTF
3. Runs `cdktf deploy` in the `iac/` folder
4. Updates the ECS task definition and rolls out the new version

This allows controlled, manual promotion of the exact same image built from `main`.

---

# 3. CI/CD Job Breakdown

---

## Job 1 — Build & Push Image to ECR (`push` on main)

This job:

* Validates required GitHub Action variables
* Logs in to AWS ECR
* Builds the Docker image (`app/`)
* Ensures the ECR repo exists
* Pushes the immutable image tagged with the Git SHA

This guarantees that:

* Builds are reproducible
* Images are never overwritten
* Every environment (dev/staging/prod) deploys the same artifact

---

## Job 2 — Deploy with CDKTF (`workflow_dispatch`)

When manually launched, GitHub prompts the user:

```
Environment to deploy? → dev / staging / prod
```

This job:

1. Computes deployment metadata

   * `CONTAINER_IMAGE=…image:SHA`
   * `ENVIRONMENT=dev|staging|prod`

2. Installs Node and Terraform

3. Builds the CDKTF application

4. Applies infrastructure changes through:

   ```
   npx cdktf deploy --auto-approve
   ```

CDKTF reads all environment-specific values from GitHub **Variables**, including:

* VPC CIDR
* Allowed CIDR for ALB
* Fargate CPU/memory
* Desired task count
* HTTPS settings
* Route53 domain configuration
* Remote Terraform backend (S3 + DynamoDB)

---

# 4. Environment-Level Isolation (dev / staging / prod)

Each environment has:

* Its own Terraform state file (`s3://bucket/dev/terraform.tfstate`, etc.)
* Its own ECR scan history
* Its own ECS service (`turbovets-app-dev-service`, …)
* Its own ALB, VPC, subnets, SGs, Route53 records, HTTPS certs

All values are supplied through **GitHub Repository Variables**.
This avoids accidental cross-environment deployments and mirrors real enterprise setups.

---

# 5. Required GitHub Secrets per environment (Sensitive)

Create an environement:

**GitHub → Settings → environments → New Environment → dev** 

Configure these under:

**GitHub → Settings → environments →  Secrets and variables → Actions → Secrets → Manage environenment secrets**

| Secret                  | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `AWS_ACCESS_KEY_ID`     | Used by GitHub Actions to authenticate to AWS |
| `AWS_SECRET_ACCESS_KEY` | Paired secret for AWS authentication          |

These credentials must belong to the IAM principal dedicated to CI/CD and should **not** be visible to developers unless explicitly authorized.

---

# 6. Required GitHub Variables (Non-sensitive per environment)

Configure in:
**GitHub → Settings → environments →  Secrets and variables → Actions → Variables → Manage environenment Variables**

| Variable           | Example                     | Description                              |
| ------------------ | --------------------------- | ---------------------------------------- |
| `AWS_REGION`       | `us-east-1`                 | Region for all AWS services              |
| `SERVICE_NAME`     | `turbovets-app`             | Used in naming ECS/ECR/VPC/ALB resources |
| `VPC_CIDR`         | `10.0.0.0/16`               | Environment-specific VPC CIDR            |
| `ALB_ALLOWED_CIDR` | `0.0.0.0/0`                 | IPs allowed to access ALB                |
| `DESIRED_COUNT`    | `1`                         | Number of ECS tasks                      |
| `FARGATE_CPU`      | `256`                       | Task CPU value                           |
| `FARGATE_MEMORY`   | `512`                       | Task memory value                        |
| `TF_STATE_BUCKET`  | `turbovets-iac-backend`     | Remote Terraform bucket                  |
| `TF_LOCK_TABLE`    | `turbovets-terraform-locks` | DynamoDB lock table                      |
| `ENABLE_HTTPS`     | `true/false`                | Enables or disables HTTPS                |
| `DOMAIN_NAME`      | `dev.example.com`           | Optional domain for ALB                  |
| `HOSTED_ZONE_ID`   | `Z1234...`                  | Route53 hosted zone                      |

Each environment (dev, staging, prod) should define a dedicated variable set.

---

# 7. How to Deploy to dev / staging / prod

From GitHub:

**Actions → CI / CD – TurboVets App → Run workflow**

Choose the environment:

```
dev
staging
prod
```

GitHub will:

* Load the correct environment variables
* Compute the image tag for the current commit
* Run CDKTF in the context of the chosen environment
* Update AWS with the correct image

This matches how large companies do manual promotions between environments.

---

# 8. Why the Image is Re-used Across Environments

The pipeline always pushes an image using:

```
ECR_REPOSITORY:SHA
```

All environments deploy that exact immutable image.

This ensures:

* **Staging tests the same artifact that goes to production**
* **No rebuilds happen between environments**
* Full traceability from Git commit → ECR tag → ECS task → ALB URL

This is standard across enterprise CI/CD (Amazon, Meta, Shopify, etc.).

---

# 9. Permission Separation (Dev vs DevOps)

GitHub allows restricting secrets and variables per environment via:

**Settings → Environments → staging/prod → Protection Rules**

You can require:

* Only DevOps can deploy to `prod`
* Only specific users can see prod variables
* Require approvals before deployment
* Require passing tests

This enforces strict separation of duties.
