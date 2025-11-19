export interface Config {
  environment: string;
  region: string;
  serviceName: string;
  containerPort: number;
  vpcCidr: string;
  containerImage: string;

  domainName?: string;
  hostedZoneId?: string;
  enableHttps: boolean;

  albAllowedCidr: string;
  desiredCount: number;
  fargateCpu: string;
  fargateMemory: string;
}

export function loadConfig(): Config {
  const environment = process.env.ENVIRONMENT ?? 'dev';
  const serviceName = process.env.SERVICE_NAME ?? 'turbovets-app';

  // Route53 and HTTPS
  const domainName = process.env.DOMAIN_NAME;
  const hostedZoneId = process.env.HOSTED_ZONE_ID;
  const enableHttpsEnv = process.env.ENABLE_HTTPS ?? 'false';
  
  return {
    environment,
    region: process.env.AWS_REGION ?? 'us-east-1',
    serviceName,
    containerPort: Number(process.env.CONTAINER_PORT ?? '3000'),
    vpcCidr: process.env.VPC_CIDR ?? '10.0.0.0/16',
    containerImage: process.env.CONTAINER_IMAGE ?? 'public.ecr.aws/docker/library/node:22-alpine',

    domainName,
    hostedZoneId,
    enableHttps:
      enableHttpsEnv.toLowerCase() === 'true' &&
      !!domainName &&
      !!hostedZoneId,
    
    albAllowedCidr: process.env.ALB_ALLOWED_CIDR ?? '0.0.0.0/0',
    desiredCount: Number(process.env.DESIRED_COUNT ?? '1'),
    fargateCpu: process.env.FARGATE_CPU ?? '256',
    fargateMemory: process.env.FARGATE_MEMORY ?? '512',
  };
}