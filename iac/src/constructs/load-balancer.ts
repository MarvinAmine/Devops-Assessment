import { Construct } from 'constructs';
import { Lb } from '../../.gen/providers/aws/lb';
import { LbTargetGroup } from '../../.gen/providers/aws/lb-target-group';
import { LbListener } from '../../.gen/providers/aws/lb-listener';
import { SecurityGroup } from '../../.gen/providers/aws/security-group';
import { Subnet } from '../../.gen/providers/aws/subnet';
import { Vpc } from '../../.gen/providers/aws/vpc';
import { Config } from '../config';

export interface LoadBalancerOutputs {
  alb: Lb;
  targetGroup: LbTargetGroup;
}

export class LoadBalancer extends Construct {
  public readonly outputs: LoadBalancerOutputs;

  constructor(
    scope: Construct,
    id: string,
    vpc: Vpc,
    subnets: Subnet[],
    albSecurityGroup: SecurityGroup,
    config: Config
  ) {
    super(scope, id);

    const alb = new Lb(this, 'Alb', {
      name: `${config.serviceName}-${config.environment}-alb`,
      loadBalancerType: 'application',
      securityGroups: [albSecurityGroup.id],
      subnets: subnets.map(s => s.id),
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    const targetGroup = new LbTargetGroup(this, 'AlbTargetGroup', {
      name: `${config.serviceName}-${config.environment}-tg`,
      port: config.containerPort,
      protocol: 'HTTP',
      targetType: 'ip',
      vpcId: vpc.id,
      healthCheck: {
        enabled: true,
        path: '/health',
        matcher: '200',
      },
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    new LbListener(this, 'AlbListener', {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    this.outputs = { alb, targetGroup };
  }
}