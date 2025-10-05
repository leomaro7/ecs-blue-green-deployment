import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export interface EcsCicdStackProps extends cdk.StackProps {
  readonly ecsService: ecs.FargateService;
  readonly ecrRepository?: ecr.Repository;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch?: string;
  readonly codestarConnectionArn: string;
}

export class EcsCicdStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcsCicdStackProps) {
    super(scope, id, props);

    // ECR リポジトリ
    this.ecrRepository = props.ecrRepository || new ecr.Repository(this, 'ApacheRepository', {
      repositoryName: 'apache-repository',
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CodeBuild プロジェクト
    const buildProject = new codebuild.PipelineProject(this, 'ApacheBuildProject', {
      projectName: 'apache-build-project',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environmentVariables: {
        AWS_DEFAULT_REGION: {
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        IMAGE_REPO_NAME: {
          value: this.ecrRepository.repositoryName,
        },
      },
    });

    // CodeBuild に ECR へのプッシュ権限を付与
    this.ecrRepository.grantPullPush(buildProject);

    // CodePipeline アーティファクト
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // CodePipeline
    this.pipeline = new codepipeline.Pipeline(this, 'ApachePipeline', {
      pipelineName: 'apache-pipeline',
      restartExecutionOnUpdate: false,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineActions.CodeStarConnectionsSourceAction({
              actionName: 'Source',
              owner: props.githubOwner,
              repo: props.githubRepo,
              branch: props.githubBranch || 'main',
              connectionArn: props.codestarConnectionArn,
              output: sourceOutput,
              triggerOnPush: true,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineActions.CodeBuildAction({
              actionName: 'CodeBuild',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipelineActions.EcsDeployAction({
              actionName: 'ApacheEcsDeploy',
              service: props.ecsService,
              deploymentTimeout: cdk.Duration.minutes(15),
              input: buildOutput,
            }),
          ],
        },
      ],
    });

  }

}