import { Construct } from 'constructs';
import { Fn } from 'cdktf';
import { Vpc } from '../../.gen/providers/aws/vpc';
import { Subnet } from '../../.gen/providers/aws/subnet';
import { InternetGateway } from '../../.gen/providers/aws/internet-gateway';
import { RouteTable } from '../../.gen/providers/aws/route-table';
import { RouteTableAssociation } from '../../.gen/providers/aws/route-table-association';
import { DataAwsAvailabilityZones } from '../../.gen/providers/aws/data-aws-availability-zones';
import { Config } from '../config';

export interface NetworkingOutputs {
  vpc: Vpc;
  publicSubnet1: Subnet;
  publicSubnet2: Subnet;
}

export class Networking extends Construct {
  public readonly outputs: NetworkingOutputs;

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    const vpc = new Vpc(this, 'Vpc', {
      cidrBlock: config.vpcCidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: {
        Name: `${config.serviceName}-${config.environment}-vpc`,
        Environment: config.environment,
      },
    });

    const azs = new DataAwsAvailabilityZones(this, 'Azs', {
      state: 'available',
    });

    const publicSubnet1 = new Subnet(this, 'PublicSubnet1', {
      vpcId: vpc.id,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: Fn.element(azs.names, 0),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${config.serviceName}-${config.environment}-public-1`,
      },
    });

    const publicSubnet2 = new Subnet(this, 'PublicSubnet2', {
      vpcId: vpc.id,
      cidrBlock: '10.0.2.0/24',
      availabilityZone: Fn.element(azs.names, 1),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${config.serviceName}-${config.environment}-public-2`,
      },
    });

    const igw = new InternetGateway(this, 'InternetGateway', {
      vpcId: vpc.id,
      tags: {
        Name: `${config.serviceName}-${config.environment}-igw`,
      },
    });

    const publicRouteTable = new RouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.id,
      route: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: igw.id,
        },
      ],
      tags: {
        Name: `${config.serviceName}-${config.environment}-public-rt`,
      },
    });

    new RouteTableAssociation(this, 'PublicRtAssoc1', {
      subnetId: publicSubnet1.id,
      routeTableId: publicRouteTable.id,
    });

    new RouteTableAssociation(this, 'PublicRtAssoc2', {
      subnetId: publicSubnet2.id,
      routeTableId: publicRouteTable.id,
    });

    this.outputs = { vpc, publicSubnet1, publicSubnet2 };
  }
}