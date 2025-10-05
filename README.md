# ECS Blue/Green Deployment with AWS CDK

This project implements Amazon ECS Blue/Green deployment using AWS CDK TypeScript with separated application infrastructure and CI/CD pipeline stacks.

## Architecture

### Application Stack (`EcsApplicationStack`)
- **VPC**: Custom VPC with public and private subnets across 2 AZs
- **NAT Gateway**: Single NAT Gateway for cost optimization
- **ECS**: Fargate cluster running Apache containers
- **ALB**: Application Load Balancer with Blue/Green target groups
- **Security**: Security groups with least privilege access

### CI/CD Stack (`EcsCicdStack`)
- **ECR**: Container registry for Docker images
- **CodeBuild**: Build project for Docker image creation
- **CodePipeline**: Automated deployment pipeline
- **Blue/Green**: ECS deployment with target group switching

## Key Benefits of Separated Stacks

1. **Independent Deployment**: Deploy infrastructure and CI/CD independently
2. **Reusability**: Reuse application stack for different environments
3. **Security**: Separate permissions for infrastructure vs CI/CD
4. **Maintenance**: Easier to manage and update components separately
5. **Cost**: Only redeploy what changed

## Prerequisites

- AWS CLI configured
- Node.js and npm installed
- Docker installed (for local testing)
- GitHub repository
- GitHub token stored in AWS Secrets Manager as `github-token`

## Configuration

Update `cdk.context.json` with your settings:

```json
{
  "githubOwner": "your-github-username",
  "githubRepo": "your-repo-name",
  "githubBranch": "main",
  "environment": "dev"
}
```

Or use CDK context parameters:

```bash
npx cdk deploy EcsCicdStack --context githubOwner=leomaro7 --context githubRepo=ecs-blue-green-deployment

npx cdk synth EcsCicdStack --context githubOwner=leomaro7 --context githubRepo=ecs-blue-green-deployment


## Deployment

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Project
```bash
npm run build
```

### 3. Deploy Application Infrastructure
```bash
npx cdk deploy EcsApplicationStack
```

### 4. Deploy CI/CD Pipeline
```bash
npx cdk deploy EcsCicdStack
```

### 5. Deploy Both (with dependency handling)
```bash
npx cdk deploy --all
```

## Stack Outputs

### EcsApplicationStack
- `LoadBalancerDNS`: ALB DNS name for accessing the application
- `BlueTargetGroupArn`: Blue target group ARN
- `GreenTargetGroupArn`: Green target group ARN
- `ClusterName`: ECS cluster name
- `ServiceName`: ECS service name

### EcsCicdStack
- `PipelineName`: CodePipeline name
- `ECRRepositoryUri`: ECR repository URI
- `BuildProjectName`: CodeBuild project name

## Blue/Green Deployment Process

1. **Source**: GitHub webhook triggers pipeline
2. **Build**: CodeBuild creates Docker image and pushes to ECR
3. **Deploy**: ECS deploys to green target group
4. **Health Check**: ALB validates green environment
5. **Traffic Switch**: ALB shifts traffic from blue to green
6. **Rollback**: Automatic rollback if health checks fail

## Monitoring

- **CloudWatch Logs**: `/ecs/apache-blue-green`
- **ECS Metrics**: Service and task metrics
- **ALB Health**: Target group health checks
- **Pipeline**: CodePipeline execution history

## Cost Optimization

- Single NAT Gateway reduces cost by ~$45/month per AZ
- Fargate Spot can be enabled for development environments
- ECR lifecycle policies for image cleanup
- Log retention policies to control storage costs

## Security Features

- Private subnets for ECS tasks
- Security groups with minimal required access
- IAM roles with least privilege
- ECR repository with image scanning
- Secrets Manager for GitHub token

## Customization

### Different Container Images
Update the `containerImage` parameter in `EcsApplicationStack`:

```typescript
const appStack = new EcsApplicationStack(app, 'EcsApplicationStack', {
  containerImage: 'nginx:latest', // Custom image
  env,
});
```

### Environment-Specific Configuration
Use CDK context for different environments:

```bash
# Development
npx cdk deploy --context environment=dev

# Production
npx cdk deploy --context environment=prod
```

## Troubleshooting

### Common Issues

1. **GitHub Token**: Ensure token is stored in Secrets Manager as `github-token`
2. **Permissions**: Check IAM roles have necessary permissions
3. **Subnet IDs**: Verify VPC has available IP addresses
4. **Health Checks**: Check ALB target group health check settings

### Useful Commands

```bash
# View stack differences
npx cdk diff EcsApplicationStack

# View synthesized CloudFormation
npx cdk synth EcsApplicationStack

# Destroy stacks (CI/CD first)
npx cdk destroy EcsCicdStack EcsApplicationStack
```

## Development

### Local Testing
```bash
# Build Docker image locally
docker build -t apache-test .

# Run locally
docker run -p 8080:80 apache-test
```

### Pipeline Testing
Push changes to your GitHub repository to trigger the pipeline automatically.

## Next Steps

- Add CloudWatch alarms for automated monitoring
- Implement blue/green deployment with Lambda lifecycle hooks
- Add application-specific health checks
- Configure auto-scaling policies
- Add SSL/TLS termination at ALB