import { Construct } from 'constructs';
import { SecurityGroup } from '../../.gen/providers/aws/security-group';
import { Vpc } from '../../.gen/providers/aws/vpc';
import { Config } from '../config';

export interface SecurityGroupOutputs {
  albSecurityGroup: SecurityGroup;
  ecsSecurityGroup: SecurityGroup;
}

export class SecurityGroups extends Construct {
  public readonly outputs: SecurityGroupOutputs;

  constructor(scope: Construct, id: string, vpc: Vpc, config: Config) {
    super(scope, id);

    const albSecurityGroup = new SecurityGroup(this, 'AlbSecurityGroup', {
      name: `${config.serviceName}-${config.environment}-alb-sg`,
      description: 'Allow HTTP from the internet',
      vpcId: vpc.id,
      ingress: [
        {
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
        {
          fromPort: 443,
          toPort: 443,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: {
        Name: `${config.serviceName}-${config.environment}-alb-sg`,
      },
    });

    const ecsSecurityGroup = new SecurityGroup(this, 'EcsSecurityGroup', {
      name: `${config.serviceName}-${config.environment}-ecs-sg`,
      description: 'Allow traffic from ALB to ECS tasks',
      vpcId: vpc.id,
      ingress: [
        {
          fromPort: config.containerPort,
          toPort: config.containerPort,
          protocol: 'tcp',
          securityGroups: [albSecurityGroup.id],
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ],
      tags: {
        Name: `${config.serviceName}-${config.environment}-ecs-sg`,
      },
    });

    this.outputs = { albSecurityGroup, ecsSecurityGroup };
  }
}