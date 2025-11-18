# iac – AWS Infrastructure with CDK for Terraform (TypeScript)

This folder contains the AWS infrastructure for the TurboVets DevOps assessment, implemented using **CDK for Terraform (CDKTF)** in **TypeScript**.

The goal is to deploy the Dockerized Express + TypeScript application behind a public load balancer on **ECS Fargate**, within an isolated **multi-AZ VPC**, using infrastructure that is:

* Modular and environment-aware  
* Least-privilege by default (IAM roles & scoped access)  
* Portable across regions/accounts  
* Easy to deploy, update, and destroy  

---

# 1. High-Level Architecture

All resources are deployed in one AWS region but across **two Availability Zones** for high availability.

### Core Components

### **VPC**

* One VPC per environment (`dev`, `staging`, `prod`)  
* CIDR: `10.0.0.0/16`  
* Two **public subnets** (ALB + ECS Fargate tasks)  
* Internet gateway for ALB/Fargate egress  
* Public subnets map public IPs (`assignPublicIp = true` for Fargate tasks in this assessment)

> Future improvement: move ECS tasks to private subnets with NAT (see Section 8).

### **ECR Repository**

* Stores app Docker images  
* Named: `${SERVICE_NAME}-${ENVIRONMENT}` (for this assessment: `turbovets-app-dev`)  
* Images pushed from developer machine or CI pipeline  

### **ECS (Fargate)**

* ECS cluster per environment  
* Fargate service with:
  * CPU: 256  
  * Memory: 512  
  * Desired count: 1  
* Task definition references **ECR image**  

### **Application Load Balancer (ALB)**

* Internet-facing  
* Listens on port `80`  
* Forwards traffic to ECS tasks on port `3000`  
* Health check on `/health`  

### **Security Groups**

* **ALB SG**  
  * Allows inbound HTTP from the internet (port 80)  
* **ECS SG**  
  * Only allows inbound traffic from ALB SG on port `3000`  

### **IAM Roles**

* **Task Execution Role**
  * Pull from ECR  
  * Push logs to CloudWatch  
* **Task Role**
  * Empty (least privilege, extend when needed)  

### **Observability**

* CloudWatch Log Group: `/ecs/turbovets-app-<env>` (e.g. `/ecs/turbovets-app-dev`)  
* ECS task logs automatically streamed  

---

# 2. Configuration & Environments

The deployment is **parameterized** using:

* `cdktf.json`  
* Environment variables  
* CDKTF context  

No AWS account, region, or sensitive values are hardcoded.

### Main Variables

| Variable          | Description                                 |
| ----------------- | ------------------------------------------- |
| `ENVIRONMENT`     | Environment name (`dev`, `staging`, `prod`) |
| `AWS_REGION`      | AWS region                                  |
| `SERVICE_NAME`    | Base service name                           |
| `CONTAINER_IMAGE` | Full ECR image URI + tag                    |
| `CONTAINER_PORT`  | Container port exposed by the app           |
| `FARGATE_CPU`     | CPU units (default 256)                     |
| `FARGATE_MEMORY`  | Memory (default 512)                        |
| `DESIRED_COUNT`   | Number of tasks (default 1)                 |

To configure local development:

```bash
cd iac
cp .env.example .env
````

Edit `.env` to override defaults, and source your variables in the command line:

```bash
set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting

printenv | grep -E '^(ENVIRONMENT|AWS_REGION|SERVICE_NAME|AWS_PROFILE|VPC_CIDR|ALB_ALLOWED_CIDR|DESIRED_COUNT|FARGATE_CPU|FARGATE_MEMORY|AWS_ACCOUNT_ID|ECR_REPOSITORY|ECR_URI|CONTAINER_PORT|TF_STATE_BUCKET|TF_LOCK_TABLE)='
```

---

# 3. Building & Deploying via GitHub Actions (CI/CD Pipeline)

This project uses a **GitHub Actions** workflow (`.github/workflows/ci-cd.yml`) to perform the full CI/CD pipeline whenever code is pushed to the `main` branch.

### 3.1 CI/CD Workflow Overview

On every push to `main`, the `build-and-deploy` job:

1. Checks out the repository.
2. Validates required repository variables (`AWS_REGION`, `ENVIRONMENT`, `SERVICE_NAME`).
3. Configures AWS credentials using an IAM user whose access key and secret are stored in **GitHub Secrets**.
4. Logs in to Amazon ECR.
5. Computes:

   * `IMAGE_TAG = $GITHUB_SHA`
   * `ECR_REPOSITORY = <aws-account>.dkr.ecr.<region>.amazonaws.com/${SERVICE_NAME}`
6. Ensures the ECR repository exists (creates it if missing).
7. Builds the Docker image from `app/Dockerfile` and tags it as `${ECR_REPOSITORY}:${IMAGE_TAG}`.
8. Pushes the image to ECR.
9. Installs IaC dependencies in `iac/` (`npm ci`, `npx cdktf get`, `npm run build`).
10. (Dev only) Optionally auto-reconciles existing AWS networking/ALB resources into Terraform state.
11. Runs:

```bash
npx cdktf deploy --auto-approve
```

with `CONTAINER_IMAGE` set to the freshly pushed ECR image.

Result: the ECS task definition is updated, the service rolls out a new revision, and the ALB continues routing traffic with **no manual steps**.

### 3.2 Required GitHub Configuration

**Repository Variables**
(Settings → Variables → Actions)

| Name             | Example         | Purpose                            |
| ---------------- | --------------- | ---------------------------------- |
| `AWS_REGION`     | `us-east-1`     | AWS region for all resources       |
| `ENVIRONMENT`    | `dev`           | Environment name                   |
| `SERVICE_NAME`   | `turbovets-app` | Base service/ECR/ECS naming prefix |
| `CONTAINER_PORT` | `3000`          | Port exposed by the Node app       |

**Repository Secrets**
(Settings → Secrets and variables → Actions → Secrets)

| Name                    | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `AWS_ACCESS_KEY_ID`     | IAM user access key (scoped for this assessment) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key                              |

The IAM user used by GitHub Actions should have **least-privilege** permissions covering:

* S3 + DynamoDB (Terraform backend)
* VPC, subnets, route tables, IGW, security groups
* ALB, Target Groups, Listeners
* ECS (cluster, service, task definition)
* ECR (repository & image operations)
* CloudWatch Logs
* IAM roles/policies strictly required by Terraform

### 3.1 Create the Remote Terraform backend (S3 + DynamoDB)

> **Run once per environment** before the first `cdktf deploy` (from your laptop is fine).
> After this, both local and CI deployments will use the same remote backend.

From the **project root**:

```bash
# 1. Create S3 bucket (us-east-1 special rule: NO LocationConstraint config block)
aws s3api create-bucket \
  --bucket "$TF_STATE_BUCKET" \
  --region "$AWS_REGION"

# 2. Enable versioning
aws s3api put-bucket-versioning \
  --bucket "$TF_STATE_BUCKET" \
  --versioning-configuration Status=Enabled

# 3. Block all public access (correct JSON syntax)
aws s3api put-public-access-block \
  --bucket "$TF_STATE_BUCKET" \
  --public-access-block-configuration '{
      "BlockPublicAcls": true,
      "IgnorePublicAcls": true,
      "BlockPublicPolicy": true,
      "RestrictPublicBuckets": true
  }'

# 4. Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket "$TF_STATE_BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'

aws dynamodb create-table \
  --table-name "$TF_LOCK_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb describe-table --table-name "$TF_LOCK_TABLE"
```

### 3.2 (Optional) Manual Local Image Build, Log in to ECR (Local), and Tag and Push (Local)

You normally won’t need this because CI builds and pushes the image, but for local testing:

```bash
cd app
docker build -f Dockerfile -t turbovets-app-local .
```

From the `iac` folder:

```bash
cd ../iac
```

Set the `ECR_URI` variable (either via `.env` or directly):

```bash
# Generic pattern – works for any AWS account
# Make sure AWS_ACCOUNT_ID, AWS_REGION, and ECR_REPOSITORY are set in .env

set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting

# Or compute it manually:
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
```

Authenticate Docker to ECR using your IAM profile (no keys in the codebase):

```bash
aws ecr get-login-password \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_URI"
```

```bash
docker tag turbovets-app-local:latest "$ECR_URI:manual-test"
docker push "$ECR_URI:manual-test"
```

---

# 4. Deploying the Infrastructure

## 4.1 Deploy from CI (Preferred)

CI already runs:

```bash
npx cdktf deploy --auto-approve
```

on each push to `main`, using the latest Docker image and updating ECS accordingly.

## 4.2 Manual Local Deploy (For Debugging)

From the `iac` directory:

```bash
cd iac

# Variables required in .env:
# ENVIRONMENT, AWS_REGION, SERVICE_NAME, AWS_PROFILE, CONTAINER_PORT,
# AWS_ACCOUNT_ID, ECR_REPOSITORY, ECR_URI, CONTAINER_IMAGE
set -a
source .env
set +a

npx cdktf deploy --auto-approve
```

**Save the Application Load Balancer DNS name for later:**

```bash
ALB_DNS=... # The ALB URL printed in the cdktf deploy outputs (alb_dns_name)
```

Deployment creates:

* VPC, subnets, route tables, internet gateway
* ALB + target group + listener
* ECS cluster, task definition, service
* CloudWatch log group

Outputs include:

```text
alb_dns_name
ecr_repository_url
ecs_service_name
config_environment
config_region
```

---

# 5. Verifying Deployment

## Health endpoint

```bash
curl -i http://$ALB_DNS/health
```

Expected:

```http
HTTP/1.1 200 OK
{"status":"ok"}
```

## Root endpoint

```bash
curl -i http://$ALB_DNS/
```

Expected:

```text
Hello from Express + TypeScript!
```

## Check Fargate logs in real time

```bash
aws logs tail /ecs/$ECR_REPOSITORY \
  --follow \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

## Check Fargate logs since 1 day

```bash
aws logs tail /ecs/$ECR_REPOSITORY \
  --since 1d \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

## Check target health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

Should show:

```text
State: healthy
```

## Verify running task’s image tag

```bash
aws ecs describe-task-definition \
  --task-definition $ECR_REPOSITORY \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  | jq '.taskDefinition.containerDefinitions[0].image'
```

---

# 6. Local Testing of the Application

If port 3000 is free:

```bash
docker run --rm -p 3000:3000 turbovets-app-local
curl http://localhost:3000/health
```

Expected:

```text
{"status":"ok"}
```

---

# 7. Cleanup (Avoid Charges)

To destroy all deployed AWS infrastructure:

```bash
cd iac
npx cdktf destroy
```

This safely deletes:

* VPC + subnets + routing
* ALB + listener + target group
* ECS cluster + service + task definition
* CloudWatch log group

**ECR repository is preserved** so image history is not accidentally destroyed.

---

# 8. Setup ACM + Route53

### Step 1 – Create a public hosted zone in Route53

In AWS console:

1. Go to **Route53 → Hosted zones → Create hosted zone**.
2. **Domain name:** `marvinmeite.cloud`
3. **Type:** Public hosted zone
4. Click **Create hosted zone**.

You’ll get:

* A set of **NS** records (4 name servers).
* An **SOA** record.

Copy the 4 NS values (they look like `ns-XXXX.awsdns-YY.net`, etc.).

The zone will have an ID like `Z1234567890ABCDEFG` – that’s your `HOSTED_ZONE_ID`.

### Step 2 – Point your registrar to Route53

On the site where you bought `marvinmeite.cloud` (Namecheap, OVH, GoDaddy, whatever):

1. Go to **Domain management** / **DNS** settings.
2. Find **Nameservers**.
3. Switch from “Default” to “Custom nameservers” (wording depends on the registrar).
4. Paste the 4 NS records from Route53.
5. Save changes.

DNS propagation can take anywhere from a few minutes to a couple of hours (sometimes up to 24h, but usually faster).

You can check when Route53 is in control:

```bash
dig NS marvinmeite.cloud +short
```

When it returns the Route53 NS servers, you’re good.

### Step 3 – Choose the app subdomain

Exemple:

* `aws-docker-terrafrom-github-actions.marvinmeite.cloud`

Use that as your `DOMAIN_NAME` in `.env`:

```bash
DOMAIN_NAME=aws-docker-terrafrom-github-actions.marvinmeite.cloud
HOSTED_ZONE_ID=Z1234567890ABCDEFG
ENABLE_HTTPS=true
```

Then re-deploy:

```bash
cd iac
set -a
source .env
set +a
npx cdktf deploy --auto-approve
```

When Terraform finishes and ACM is Issued:

```bash
curl -i https://app.marvinmeite.cloud/health
```

# 9. Notes & Future Enhancements


* Move tasks to fully private subnets and remove public IP assignment
* Add auto-scaling policies on CPU/memory
* Migrate CI pipeline from IAM user access keys to **GitHub OIDC** federation
* Add environment-scoped GitHub deployments (dev/staging/prod)
* Add Secrets Manager integration for runtime secrets

```
::contentReference[oaicite:0]{index=0}
```
