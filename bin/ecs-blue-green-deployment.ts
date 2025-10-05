#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcsApplicationStack } from '../lib/ecs-application-stack';
import { EcsCicdStack } from '../lib/ecs-cicd-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// GitHub リポジトリ情報 (Context から取得、なければデフォルト値)
const githubOwner = app.node.tryGetContext('githubOwner') || 'your-github-username';
const githubRepo = app.node.tryGetContext('githubRepo') || 'ecs-blue-green-deployment';
const githubBranch = app.node.tryGetContext('githubBranch') || 'main';

// CodeStar Connection ARN (Context から取得、必須)
const codestarConnectionArn = app.node.tryGetContext('codestarConnectionArn') || 'arn:aws:codeconnections:ap-northeast-1:268546037544:connection/9481d102-2d96-42b4-850c-e7091f3a1de5';
if (!codestarConnectionArn) {
  throw new Error('codestarConnectionArn context value is required. Please set it using: cdk deploy -c codestarConnectionArn=arn:aws:codestar-connections:region:account:connection/connection-id');
}

// Application スタック
const appStack = new EcsApplicationStack(app, 'EcsApplicationStack', {
  env,
  description: 'ECS Blue/Green Deployment - Application Infrastructure',
});

// CI/CD Pipeline スタック
const cicdStack = new EcsCicdStack(app, 'EcsCicdStack', {
  env,
  description: 'ECS Blue/Green Deployment - CI/CD Pipeline',
  ecsService: appStack.service,
  githubOwner,
  githubRepo,
  githubBranch,
  codestarConnectionArn,
});

// Add dependency - CI/CD stack depends on application stack
cicdStack.addDependency(appStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'apache-ecs');
cdk.Tags.of(app).add('Environment', app.node.tryGetContext('environment') || 'dev');