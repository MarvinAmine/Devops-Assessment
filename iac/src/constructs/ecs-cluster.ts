import { Construct } from 'constructs';
import { EcsCluster } from '../../.gen/providers/aws/ecs-cluster';
import { EcsTaskDefinition } from '../../.gen/providers/aws/ecs-task-definition';
import { EcsService } from '../../.gen/providers/aws/ecs-service';
import { CloudwatchLogGroup } from '../../.gen/providers/aws/cloudwatch-log-group';
import { EcrRepository } from '../../.gen/providers/aws/ecr-repository';
import { IamRole } from '../../.gen/providers/aws/iam-role';
import { LbTargetGroup } from '../../.gen/providers/aws/lb-target-group';
import { SecurityGroup } from '../../.gen/providers/aws/security-group';
import { Subnet } from '../../.gen/providers/aws/subnet';
import { Config } from '../config';

export interface EcsClusterOutputs {
  cluster: EcsCluster;
  service: EcsService;
  ecrRepo: EcrRepository;
}

export class EcsClusterConstruct extends Construct {
  public readonly outputs: EcsClusterOutputs;

  constructor(
    scope: Construct,
    id: string,
    subnets: Subnet[],
    securityGroup: SecurityGroup,
    targetGroup: LbTargetGroup,
    taskExecutionRole: IamRole,
    taskRole: IamRole,
    config: Config
  ) {
    super(scope, id);

    const ecrRepo = new EcrRepository(this, 'EcrRepository', {
      name: config.ecrRepoName,
      imageScanningConfiguration: {
        scanOnPush: true,
      },
      imageTagMutability: 'MUTABLE',
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    const logGroup = new CloudwatchLogGroup(this, 'LogGroup', {
      name: `/ecs/${config.serviceName}-${config.environment}`,
      retentionInDays: 7,
      skipDestroy: true,
    });

    const cluster = new EcsCluster(this, 'EcsCluster', {
      name: `${config.serviceName}-${config.environment}-cluster`,
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    const taskDefinition = new EcsTaskDefinition(this, 'TaskDefinition', {
      family: `${config.serviceName}-${config.environment}`,
      cpu: '256',
      memory: '512',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      executionRoleArn: taskExecutionRole.arn,
      taskRoleArn: taskRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: config.serviceName,
          image: config.containerImage,
          essential: true,
          portMappings: [
            {
              containerPort: config.containerPort,
              hostPort: config.containerPort,
              protocol: 'tcp',
            },
          ],
          environment: [
            {
              name: 'NODE_ENV',
              value: 'production',
            },
            {
              name: 'PORT',
              value: config.containerPort.toString(),
            },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': logGroup.name,
              'awslogs-region': config.region,
              'awslogs-stream-prefix': config.serviceName,
            },
          },
        },
      ]),
    });

    const service = new EcsService(this, 'EcsService', {
      name: `${config.serviceName}-${config.environment}-service`,
      cluster: cluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        subnets: subnets.map(s => s.id),
        assignPublicIp: true,
        securityGroups: [securityGroup.id],
      },
      loadBalancer: [
        {
          containerName: config.serviceName,
          containerPort: config.containerPort,
          targetGroupArn: targetGroup.arn,
        },
      ],
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    this.outputs = { cluster, service, ecrRepo };
  }
}