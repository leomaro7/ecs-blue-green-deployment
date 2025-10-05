import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from 'constructs';

export interface EcsApplicationStackProps extends cdk.StackProps {
  readonly containerImage?: string;
}

export class EcsApplicationStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ecsSg: ec2.SecurityGroup;
  public readonly albSg: ec2.SecurityGroup;
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly blueTargetGroup: elbv2.ApplicationTargetGroup;
  public readonly greenTargetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props?: EcsApplicationStackProps) {
    super(scope, id, props);

    // VPC, サブネット
    this.vpc = new ec2.Vpc(this, 'ApacheVpc', {
      vpcName: 'apache-vpc',  
      ipAddresses: ec2.IpAddresses.cidr('10.100.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'apache-public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'apache-private-ecs',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'apache-private-alb',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'apache-private-client',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // ECS クラスター
    this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
      clusterName: 'apache-cluster',
      defaultCloudMapNamespace: {
        name: 'apache.local',
        vpc: this.vpc,
      },
      vpc: this.vpc,
    });

    // ECS タスク実行ロール
    const taskExecutionRole = new iam.Role(this, "ApacheEcsTaskExecutionRole", {
      roleName: "apache-ecs-task-execution-role",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    // タスク定義
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'ApacheTaskDefinition', {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: taskExecutionRole,
    });

    const containerImage = props?.containerImage || 'public.ecr.aws/docker/library/httpd:2.4';

    this.taskDefinition.addContainer('ApacheContainer', {
      containerName: 'apache-container',
      image: ecs.ContainerImage.fromRegistry(containerImage),
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'apache',
      }),
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // セキュリティグループ (ECS)
    this.ecsSg = new ec2.SecurityGroup(this, 'ApacheEcsSg', {
      securityGroupName: 'apache-ecs-sg',
      description: 'Security group for ECS',
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    // インフラストラクチャロール
    const infrastructureRole = new iam.Role(this, "InfrastructureEcsRole", {
      roleName: "infrastructure-ecs-role",
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonECSInfrastructureRolePolicyForLoadBalancers"
        ),
      ],
    });

    // ECS サービス
    this.service = new ecs.FargateService(this, 'ApacheService', {
      serviceName: 'apache-service',
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      platformVersion: ecs.FargatePlatformVersion.LATEST,
      desiredCount: 1,
      assignPublicIp: false,
      securityGroups: [this.ecsSg],
      vpcSubnets: this.vpc.selectSubnets({
        subnetGroupName: "apache-private-ecs",
      }),
      deploymentStrategy: ecs.DeploymentStrategy.BLUE_GREEN,
      bakeTime: cdk.Duration.minutes(5),
    });

    // セキュリティグループ(ALB)
    this.albSg = new ec2.SecurityGroup(this, "ApacheAlbSg", {
      securityGroupName: "apache-alb-sg",
      description: "Security group for ALB",
      vpc: this.vpc,
      allowAllOutbound: true,
      disableInlineRules: true,
    });

    new ec2.CfnSecurityGroupIngress(this, 'AlbSgIngress80', {
      groupId: this.albSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      cidrIp: '10.100.0.0/16',
    });

    new ec2.CfnSecurityGroupIngress(this, 'AlbSgIngress8080', {
      groupId: this.albSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 8080,
      toPort: 8080,
      cidrIp: '10.100.0.0/16',
    });

    // ALB
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ApacheAlb', {
      loadBalancerName: 'apache-alb',
      vpc: this.vpc,
      internetFacing: false,
      securityGroup: this.albSg,
          vpcSubnets: this.vpc.selectSubnets({
        subnetGroupName: "apache-private-alb",
      }),
    });

    // ターゲットグループ (Blue)
    this.blueTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApacheBlueTargetGroup', {
      targetGroupName: 'apache-blue-target-group',
      vpc: this.vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        port: "80",
        protocol: elbv2.Protocol.HTTP,
      },
    });

    // ターゲットグループ (Green)
    this.greenTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApacheGreenTargetGroup', {
      targetGroupName: 'apache-green-target-group',
      vpc: this.vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        port: "80",
        protocol: elbv2.Protocol.HTTP,
      },
    });

    // リスナー
    const listener = this.alb.addListener('ApacheListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found",
      }),
    });
    const listenerRule = new elbv2.ApplicationListenerRule(this,"AlbListenerRule",
      {
        listener: listener,
        priority: 1,
        conditions: [elbv2.ListenerCondition.pathPatterns(["*"])],
        action: elbv2.ListenerAction.forward([this.blueTargetGroup]),
      }
    );

    const testListener = this.alb.addListener("ApacheTestListener", {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found",
      }),
    });
    const testListenerRule = new elbv2.ApplicationListenerRule(this,"AlbTestListenerRule",
      {
        listener: testListener,
        priority: 1,
        conditions: [elbv2.ListenerCondition.pathPatterns(["*"])],
        action: elbv2.ListenerAction.forward([this.greenTargetGroup]),
      }
    );
    
    const target = this.service.loadBalancerTarget({
      containerName: 'apache-container',
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
      alternateTarget: new ecs.AlternateTarget("AlternateTarget", {
        alternateTargetGroup: this.greenTargetGroup,
        productionListener:
          ecs.ListenerRuleConfiguration.applicationListenerRule(
            listenerRule
          ),
        testListener:
          ecs.ListenerRuleConfiguration.applicationListenerRule(
            testListenerRule
          ),
        role: infrastructureRole,
      }),
    });
    target.attachToApplicationTargetGroup(this.blueTargetGroup);


    // ALB Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'DNS name of the Application Load Balancer',
      exportName: `${this.stackName}-LoadBalancerDNS`,
    });

  }
}