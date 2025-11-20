## ✅ DONE

1. **Docker & Local Environment**
   1.1. Created a multi-stage `Dockerfile` (builder + lightweight runtime on `node:22-alpine`).
   1.2. Installed only production dependencies in the runtime and cleaned npm cache.
   1.3. Ran the app as a non-root user for better container security.
   1.4. Added `docker-compose.yml` to build the image and expose `http://localhost:3000`.
   1.5. Verified the `/health` endpoint responds with HTTP 200 at `http://localhost:3000/health`.
   1.6. Added `.dockerignore` to keep the build context small (`node_modules`, `dist`, `.git`, etc.).

2. **AWS Infrastructure with CDK for Terraform (CDKTF)**
   2.1. Defined an `AwsProvider` with region loaded from environment variables (no hardcoded region/account).
   2.2. Provisioned a VPC with DNS support and a configurable CIDR.
   2.3. Created two public subnets across distinct Availability Zones.
   2.4. Configured an Internet Gateway, route table, and route table associations.
   2.5. Created security groups for ALB and ECS tasks, allowing only the necessary ports.
   2.6. Created an ECR repository with image scanning enabled.
   2.7. Provisioned an ECS cluster and a Fargate task definition (CPU 256, memory 512).
   2.8. Wired the container definition to a configurable `CONTAINER_IMAGE` and `CONTAINER_PORT`.
   2.9. Configured CloudWatch Log Group and ECS log configuration.
   2.10. Created separate IAM roles for task execution and task runtime (least privilege by design).
   2.11. Configured an Application Load Balancer, target group, listener, and `/health` health check.
   2.12. Created an ECS Fargate service associated with the ALB target group.
   2.13. Exposed Terraform outputs for `alb_dns_name`, `ecr_repository_url`, `ecs_service_name`, and config metadata.
   2.14. Wired remaining configuration variables in CDKTF (e.g. `DESIRED_COUNT`, `FARGATE_CPU`, `FARGATE_MEMORY`, `ALB_ALLOWED_CIDR`) so they are fully controlled via env.
   2.15 Use remote Terraform backend (S3 + DynamoDB)
   2.16 Add HTTPS via ACM + ALB listener on port 443
   2.17 Add Route53 domain
   2.18 Extend CDKTF stack to support `dev`, `staging`, and `prod` with environment-specific settings.

3. **CI/CD Pipeline with GitHub Actions**
   3.1. Added `.github/workflows/ci-cd.yml` triggered on push to `main`.
   3.2. Configured AWS credentials via `aws-actions/configure-aws-credentials` using GitHub Secrets.
   3.3. Logged into Amazon ECR using `aws-actions/amazon-ecr-login`.
   3.4. Computed image metadata (ECR repo URI + image tag = commit SHA).
   3.5. Built the Docker image from `app/Dockerfile`.
   3.6. Pushed the tagged image to ECR.
   3.7. Installed IaC dependencies (`npm ci` in `iac/`).
   3.8. Ran `npx cdktf get` to generate provider bindings.
   3.9. Built the CDKTF app (`npm run build`).
   3.10. Deployed the stack with `npx cdktf deploy --auto-approve`, passing the fresh image URI via `CONTAINER_IMAGE`.

4. **Configuration, Portability & Security**
   4.1. Centralized non-sensitive config in `.env` and GitHub Repository Variables.
   4.2. Stored AWS credentials only in GitHub Secrets (no credentials in code or repo).
   4.3. Parameterized region, environment, service name, ECR repo name, VPC CIDR, and container port.
   4.4. Ensured the stack can be deployed in another AWS account by only changing variables/secrets.
   4.5. Applied least-privilege IAM on task execution role and left task role empty for further scoping.
   4.6. Added defense-in-depth via IAM, security groups, VPC isolation, and CloudWatch logging.

5. **Documentation & Communication**
   5.1. Wrote `iac/README.md` with step-by-step deployment, verification, and teardown instructions.
   5.2. Documented CI/CD setup, secrets, and variables in `.github/workflows/README.md`.
   5.3. Add the CI status badge pointing to `ci-cd.yml` in the main `README.md`.
   5.4. Shared the repository and ALB URL with the team and explained the approach by email.

   

---

## 🔄 IN PROGRESS

1. Record and upload the 2–5 minute walkthrough video covering:
   1.1. Docker & Compose flow and `/health` endpoint.
   1.2. CDKTF stack structure and key constructs.
   1.3. GitHub Actions pipeline from push → build → deploy.
   1.4. How to configure variables/secrets to deploy in the team’s AWS account.
   1.5. Tradeoffs, constraints, and planned improvements.

---

## ⏱ TODO IMMEDIATE
0. Share my gist files of `AWS group policies` and `.env` files with you
1. Double-check all docs (README / workflows) align 100% with the actual deployed architecture (e.g. public vs private subnets).
2. Run a full “from scratch” deployment in a clean AWS profile to validate reproducibility.

---

## 🌱 TODO FUTURE

1. **Infrastructure & Security Enhancements**
   1.1. Using LocalStack https://www.localstack.cloud/ to test AWS infrastructure locally, which could save charges, be more secure and time efficient. Add tests for Terraform to maintain a stable deployment environment.
   1.2. Force the promote with PR on master, and add pipeline checks on the PR ensuring the commit respects the code coverage, pair PR review number, vulnerability checks (Snyk, SonarQube ...), only one commit on the PR, the branch should be "feature|devops|fix" ...
   1.3. Test the Staging and Prod environments (creating new users with the right permissions using least privilege might take too much time and cost me some money on AWS).
   1.4. Move the Prod CI to its own GitHub repository, completely separated from the Dev and Staging environments.
   1.4. Introduce autoscaling policies on ECS Fargate based on CPU/memory.
   1.5. Use GitHub OIDC instead of long-lived AWS keys in Secrets (requires AWS Organization).
   1.6. Add rate limiting and WAF/Shield for better protection.
   1.7. Add a dependency bot/GitHub action/AWS service (GuardDuty ...) to check the vulnerabilities in the packages.
   1.8. Review all the policies to ensure least privilege.

2. **Observability & Testing**
   2.1. Add synthetic health checks and alarms for ALB 5xx and target health linked with a notification service like SNS.
   2.2. Add integration tests that hit the ALB `/health` and root endpoint after deployment.
   2.3. Integrate tests into the CI pipeline and gate deployment on passing tests.

3. **Developer Experience & Multi-Env**
   3.2. Add environment-specific GitHub workflows or matrix builds.
   3.3. Integrate my previous SWE Turbovets assessment dashboard project (`turbovets-dashboard`) into the docker of this project.

4. **Feature Roadmap (Post-Assessment)**
   4.1. Enhance the AWS architecture diagrams and keep them in sync with the code.
   4.2. Add more advanced cost-optimization patterns (reserved capacity, right-sizing, etc.).
