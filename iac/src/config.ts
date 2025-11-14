export interface Config {
  environment: string;
  region: string;
  serviceName: string;
  ecrRepoName: string;
  containerPort: number;
  vpcCidr: string;
  containerImage: string;
}

export function loadConfig(): Config {
  const environment = process.env.ENVIRONMENT ?? 'dev';
  const serviceName = process.env.SERVICE_NAME ?? 'turbovets-app';
  
  return {
    environment,
    region: process.env.AWS_REGION ?? 'us-east-1',
    serviceName,
    ecrRepoName: process.env.ECR_REPOSITORY_NAME ?? `${serviceName}-${environment}`,
    containerPort: Number(process.env.CONTAINER_PORT ?? '3000'),
    vpcCidr: process.env.VPC_CIDR ?? '10.0.0.0/16',
    containerImage: process.env.CONTAINER_IMAGE ?? 'public.ecr.aws/docker/library/node:22-alpine',
  };
}