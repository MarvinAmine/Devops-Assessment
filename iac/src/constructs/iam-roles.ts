import { Construct } from 'constructs';
import { IamRole } from '../../.gen/providers/aws/iam-role';
import { IamRolePolicyAttachment } from '../../.gen/providers/aws/iam-role-policy-attachment';
import { Config } from '../config';

export interface IamRoleOutputs {
  taskExecutionRole: IamRole;
  taskRole: IamRole;
}

export class IamRoles extends Construct {
  public readonly outputs: IamRoleOutputs;

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    const taskExecutionRole = new IamRole(this, 'TaskExecutionRole', {
      name: `${config.serviceName}-${config.environment}-task-exec`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: ['ecs-tasks.amazonaws.com'],
            },
            Action: ['sts:AssumeRole'],
          },
        ],
      }),
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    new IamRolePolicyAttachment(this, 'TaskExecutionRolePolicy', {
      role: taskExecutionRole.name,
      policyArn:
        'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
    });

    new IamRolePolicyAttachment(this, 'TaskExecutionEcrReadOnly', {
      role: taskExecutionRole.name,
      policyArn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly',
    });

    const taskRole = new IamRole(this, 'TaskRole', {
      name: `${config.serviceName}-${config.environment}-task-role`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: ['ecs-tasks.amazonaws.com'],
            },
            Action: ['sts:AssumeRole'],
          },
        ],
      }),
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    this.outputs = { taskExecutionRole, taskRole };
  }
}