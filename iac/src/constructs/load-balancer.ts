import { Construct } from 'constructs';
import { Lb } from '../../.gen/providers/aws/lb';
import { LbTargetGroup } from '../../.gen/providers/aws/lb-target-group';
import { LbListener } from '../../.gen/providers/aws/lb-listener';
import { SecurityGroup } from '../../.gen/providers/aws/security-group';
import { Subnet } from '../../.gen/providers/aws/subnet';
import { Vpc } from '../../.gen/providers/aws/vpc';
import { Config } from '../config';

import { AcmCertificate } from '../../.gen/providers/aws/acm-certificate';
import { AcmCertificateValidation } from '../../.gen/providers/aws/acm-certificate-validation';
import { Route53Record } from '../../.gen/providers/aws/route53-record';

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

    if (config.enableHttps && config.domainName && config.hostedZoneId) {
      this.configureHttps(alb, targetGroup, config);
    } else {
      this.configureHttpOnly(alb, targetGroup);
    }


    this.outputs = { alb, targetGroup };
  }

  private configureHttps(
  alb: Lb,
  targetGroup: LbTargetGroup,
  config: Config
  ) {
    const certificate = new AcmCertificate(this, 'AlbCertificate', {
      domainName: config.domainName!,
      validationMethod: 'DNS',
      lifecycle: { createBeforeDestroy: true },
      tags: {
        Environment: config.environment,
        Service: config.serviceName,
      },
    });

    const validationRecord = new Route53Record(this, 'AlbCertValidationRecord', {
      allowOverwrite: true,
      zoneId: config.hostedZoneId!,
      name: certificate.domainValidationOptions.get(0).resourceRecordName,
      type: certificate.domainValidationOptions.get(0).resourceRecordType,
      records: [certificate.domainValidationOptions.get(0).resourceRecordValue],
      ttl: 60,
    });

    const certValidation = new AcmCertificateValidation(
      this,
      'AlbCertificateValidation',
      {
        certificateArn: certificate.arn,
        validationRecordFqdns: [validationRecord.fqdn],
      }
    );

    new LbListener(this, 'AlbHttpsListener', {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: 'HTTPS',
      sslPolicy: 'ELBSecurityPolicy-2016-08',
      certificateArn: certValidation.certificateArn,
      defaultAction: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    new LbListener(this, 'AlbHttpRedirectListener', {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [
        {
          type: 'redirect',
          redirect: {
            port: '443',
            protocol: 'HTTPS',
            statusCode: 'HTTP_301',
          },
        },
      ],
    });

    new Route53Record(this, 'AlbAliasRecord', {
      zoneId: config.hostedZoneId!,
      name: config.domainName!,
      type: 'A',
      allowOverwrite: true,
      alias: {
        name: alb.dnsName,
        zoneId: alb.zoneId,
        evaluateTargetHealth: true,
      },
    });
  }

  private configureHttpOnly(alb: Lb, targetGroup: LbTargetGroup) {
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
  }

}


