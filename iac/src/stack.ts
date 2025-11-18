import { TerraformStack, TerraformOutput } from 'cdktf';
import { Construct } from 'constructs';
import { AwsProvider } from '../.gen/providers/aws/provider';
import { loadConfig } from './config';
import { configureBackend } from "./backend";
import { Networking } from './constructs/networking';
import { SecurityGroups } from './constructs/security-groups';
import { IamRoles } from './constructs/iam-roles';
import { LoadBalancer } from './constructs/load-balancer';
import { EcsClusterConstruct } from './constructs/ecs-cluster';

export class TurboVetsStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const config = loadConfig();

    // Provider
    new AwsProvider(this, 'Aws', {
      region: config.region,
    });

    // Attach dynamic S3 backend
    configureBackend(this);

    // Networking
    const networking = new Networking(this, 'Networking', config);
    const { vpc, publicSubnet1, publicSubnet2 } = networking.outputs;

    // Security Groups
    const securityGroups = new SecurityGroups(this, 'SecurityGroups', vpc, config);
    const { albSecurityGroup, ecsSecurityGroup } = securityGroups.outputs;

    // IAM Roles
    const iamRoles = new IamRoles(this, 'IamRoles', config);
    const { taskExecutionRole, taskRole } = iamRoles.outputs;

    // Load Balancer
    const loadBalancer = new LoadBalancer(
      this,
      'LoadBalancer',
      vpc,
      [publicSubnet1, publicSubnet2],
      albSecurityGroup,
      config
    );
    const { alb, targetGroup } = loadBalancer.outputs;

    // ECS Cluster & Service
    const ecsCluster = new EcsClusterConstruct(
      this,
      'EcsCluster',
      [publicSubnet1, publicSubnet2],
      ecsSecurityGroup,
      targetGroup,
      taskExecutionRole,
      taskRole,
      config
    );
    const { service, ecrRepo } = ecsCluster.outputs;

    // Outputs
    new TerraformOutput(this, 'alb_dns_name', {
      value: alb.dnsName,
      description: 'Public DNS name of the Application Load Balancer exposing /health',
    });

    new TerraformOutput(this, 'ecr_repository_url', {
      value: ecrRepo.repositoryUrl,
      description: 'ECR repository URI for CI/CD image pushes',
    });

    new TerraformOutput(this, 'ecs_service_name', {
      value: service.name,
    });

    new TerraformOutput(this, 'config_environment', {
      value: config.environment,
    });

    new TerraformOutput(this, 'config_domain_name', {
      value: config.domainName ?? '',
    });

    new TerraformOutput(this, 'app_base_url', {
      value: config.domainName
        ? `https://${config.domainName}`
        : `http://${alb.dnsName}`,
    });

    new TerraformOutput(this, 'config_region', {
      value: config.region,
    });

    new TerraformOutput(this, 'config_service_name', {
      value: config.serviceName,
    });
  }
}