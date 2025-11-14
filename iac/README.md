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
* **Public subnets** (ALB)
* **Private subnets** (ECS Fargate tasks)
* Internet gateway for ALB egress
* Public subnets map public IPs (Fargate uses `assignPublicIp = true` for simplicity)

### **ECR Repository**

* Stores app Docker images
* Named: `turbovets-app`
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

  * Allows inbound HTTP from the internet
* **ECS SG**

  * Only allows inbound traffic from ALB SG on port `3000`

### **IAM Roles**

* **Task Execution Role**

  * Pull from ECR
  * Push logs to CloudWatch
* **Task Role**

  * Empty (least privilege, extend when needed)

### **Observability**

* CloudWatch Log Group: `/ecs/turbovets-app-<env>`
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
```

Edit `.env` to override defaults, and source your variables in the command line.

```bash
set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting
printenv | grep -E '^(ENVIRONMENT|AWS_REGION|SERVICE_NAME|AWS_PROFILE|VPC_CIDR|ALB_ALLOWED_CIDR|DESIRED_COUNT|FARGATE_CPU|FARGATE_MEMORY|AWS_ACCOUNT_ID|ECR_REPOSITORY|ECR_URI|CONTAINER_PORT)='
```bash

---

# 3. Building & Pushing the Docker Image (Local or CI)

From the **project root**:

### 3.1 Build your app image

```bash
cd app
docker build -f Dockerfile -t turbovets-app-local .
```

### 3.2 Log in to ECR

Move into the IaC folder:

```bash
cd ../iac
```

Set the ECR_URI variable:

```bash
# Generic pattern – works for any AWS account
# Set the variables(AWS_ACCOUNT_ID, AWS_REGION, and ECR_REPOSITORY)) in the .env
set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting
```
or
```bash
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
```

Authenticate Docker to ECR using your IAM profile (no keys in the codebase):

```bash
aws ecr get-login-password \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_URI"
```

### 3.3 Tag and push

```bash
docker tag turbovets-app-local:latest "$ECR_URI:manual-test"
docker push "$ECR_URI:manual-test"
```

---

# 4. Deploying the Infrastructure

Move into the IaC directory:

```bash
cd iac
```

Deploy with your image tag:

```bash
# Variables required in the .env: ENVIRONMENT, AWS_REGION, SERVICE_NAME, AWS_PROFILE, CONTAINER_PORT, AWS_ACCOUNT_ID, ECR_REPOSITORY, ECR_URI and CONTAINER_IMAGE
set -a              # export all variables defined from now on
source .env         # load variables from .env
set +a              # stop auto-exporting
```

```
npx cdktf deploy --auto-approve
```

**Save the Application load balencer for later**
ALB_DNS=... #The url of the ALB retrived from the "npx cdktf deploy" command

Deployment creates:

* VPC, subnets, route tables, internet gateway
* ALB + target group + listener
* ECS cluster, task definition, service
* CloudWatch log group

Outputs include:

```
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

```
Hello from Express + TypeScript!
```

## Check Fargate logs in real time

```bash
aws logs tail /ecs/$ECR_REPOSITORY \
  --follow \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

## Check Fargate the logs since 1 day 
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

```
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

```
{"status":"ok"}
```

---

# 7. Cleanup (Avoid Charges)

To destroy all deployed AWS infrastructure:

```bash
cd iac
AWS_PROFILE=turbovets-assessment npx cdktf destroy
```

This safely deletes:

* VPC + subnets + routing
* ALB + listener + target group
* ECS cluster + service + task definition
* CloudWatch log group

**ECR repository is preserved** so image history is not accidentally destroyed.

---

# 8. Notes & Future Enhancements

* Add HTTPS via ACM + ALB listener on port 443
* Add Route53 domain
* Move tasks to fully private subnets and remove public IP assignment
* Add auto-scaling policies on CPU/memory
* Implement CI pipeline (GitHub Actions OIDC → AWS)
* Add environment-scoped GitHub deployments (dev/staging/prod)
* Add Secrets Manager integration for runtime secrets

---

This README fully covers architecture, usage, deployment, verification, and teardown — exactly what a DevOps assignment reviewer expects.

If you want, I can also generate the **final full repository README** that ties the App + Docker + IaC together.
