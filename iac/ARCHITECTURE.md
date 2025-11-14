# iac – AWS Infrastructure with CDK for Terraform (TypeScript)

This folder contains the AWS infrastructure for the TurboVets DevOps assessment, implemented using **CDK for Terraform (CDKTF)** in **TypeScript**.

The goal is to deploy the Dockerized Express + TypeScript app behind a public load balancer on **ECS Fargate**, in a **multi-AZ VPC**, with infrastructure that is:

- Portable between AWS accounts and regions
- Least-privilege by default (IAM roles & scoped access)
- Secure by default (least-privilege IAM, no hardcoded secrets)
- Easy to deploy and destroy with a few commands

---

## 1. High-Level Architecture

All resources live in a **single AWS region** but span **multiple Availability Zones** for high availability.

Planned components:

- **VPC**
  - 1 VPC per environment (`dev`, `staging`, `prod`)
  - 2 Availability Zones
  - Public subnets for the **Application Load Balancer (ALB)**
  - Private subnets for **ECS Fargate tasks**
  - Single NAT Gateway (cost-aware for early-stage SaaS)

- **ECR Repository**
  - ECR repo to store the app image (e.g. `turbovets-app-dev`)
  - Images are built and pushed from GitHub Actions

- **ECS (Fargate) Service**
  - ECS cluster per environment
  - Fargate task definition using the image from ECR
  - CPU/memory and desired count configurable via environment variables
  - Tasks placed in **private subnets** only

- **Load Balancer**
  - Internet-facing **Application Load Balancer** in public subnets
  - Target group forwarding traffic to ECS tasks on port `3000`
  - HTTP listener on port `80` (HTTPS/Route53 can be added as a later enhancement)
  - Publicly exposes the `/health` endpoint

- **Security Groups**
  - `alb_sg`: allows inbound HTTP (and optionally HTTPS) from the internet
  - `ecs_service_sg`: allows inbound traffic **only from `alb_sg`** on port `3000`
  - Default outbound allowed for both

- **IAM Roles (Least Privilege)**
  - **Task Execution Role**:
    - Pull images from ECR
    - Write logs to CloudWatch Logs
  - **Task Role**:
    - Minimal/empty for now; can be extended when the app needs AWS APIs

- **Observability**
  - CloudWatch Log Group for ECS tasks
  - ECS task logs streamed to CloudWatch

This gives a realistic, production-minded baseline without over-engineering multi-region DR.

---

## 2. Configuration & Environments

The infrastructure is **fully configurable via environment variables** and CDKTF context.  
There are **no hardcoded account IDs, regions, or credentials**.

Key configuration is done through:

- `cdktf.json`
- `.env` (local only) based on `.env.example`
- Environment variables in your shell / CI (GitHub Actions)

### 2.1. Environment Variables

`iac/.env.example` documents the main variables:

- `ENVIRONMENT` – logical environment name (`dev`, `staging`, `prod`)
- `AWS_REGION` – AWS region to deploy to (e.g. `us-east-1`)
- `SERVICE_NAME` – base service name (e.g. `turbovets-app`)
- `VPC_CIDR` – VPC CIDR block (e.g. `10.0.0.0/16`)
- `ALB_ALLOWED_CIDR` – CIDR allowed to reach the ALB (e.g. `0.0.0.0/0`)
- `DESIRED_COUNT` – ECS service desired task count
- `FARGATE_CPU` / `FARGATE_MEMORY` – task CPU/memory in Fargate units

For **local use**, you can copy this file:

```bash
cd iac
cp .env.example .env
# then edit .env if needed
