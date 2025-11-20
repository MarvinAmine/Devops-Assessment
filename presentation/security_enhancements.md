
### **IAM Access Model (Option A – Secure Group-Based Permissions)**

To follow AWS security best practices, all human access is managed through IAM **groups**, not inline user policies.

We use the following groups:

| IAM Group              | Purpose                            | Permissions                                        |
| ---------------------- | ---------------------------------- | -------------------------------------------------- |
| `turbovets-dev-ci`     | GitHub Actions OIDC deploy role    | AssumeRole only + no direct AWS API rights         |
| `turbovets-dev-ops`    | Developer local environment access | Read-only or scoped write access depending on role |
| `turbovets-dev-viewer` | Basic view-only access             | CloudWatch + ECS describe + ECR list               |

**No long-lived credentials or AWS secret keys** are stored in the repo or GitHub.
Instead, GitHub Actions uses **AWS OIDC federation** to assume a role without secrets.

IAM group policies are stored outside the repo and never exposed publicly.


### **Upload policies separately in a *private* GitHub Gist**

Pros: clean, readable, linkable
Cons: cannot be public

Steps:

1. Create a *secret* Gist.
2. Paste the **JSON policies**.
3. Share the link **privately** with TurboVets.

This is the most common industry practice for assessments.
