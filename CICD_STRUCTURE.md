# CI/CD構造の設計 (CI/CD Structure Design)

## 分離されたCodeBuild設定の利点

### Before (統合型)
```typescript
// 全ての設定が1つのオブジェクトに集約
const buildProject = new codebuild.Project(this, 'ApacheBuildProject', {
  projectName: 'apache-build-project',
  source: codebuild.Source.gitHub({ /* 多くの設定... */ }),
  environment: { /* 設定... */ },
  buildSpec: codebuild.BuildSpec.fromObject({ /* 複雑な設定... */ }),
  environmentVariables: { /* 設定... */ },
});
```

### After (分離型)
```typescript
// 各設定が明確に分離され、理解しやすい
const sourceConfig = this.createSourceConfiguration(props);
const buildEnvironment = this.createBuildEnvironment();
const environmentVariables = this.createEnvironmentVariables();
const buildSpecConfig = this.createBuildSpecification();

const buildProject = new codebuild.Project(this, 'ApacheBuildProject', {
  projectName: 'apache-build-project',
  source: sourceConfig,
  environment: buildEnvironment,
  buildSpec: buildSpecConfig,
  environmentVariables: environmentVariables,
});
```

## 設定の分離構造

### 1. ソース設定 (`createSourceConfiguration`)
**目的**: GitHubリポジトリとの接続設定
```typescript
private createSourceConfiguration(props: EcsCicdStackProps): codebuild.Source {
  return codebuild.Source.gitHub({
    owner: props.githubOwner,
    repo: props.githubRepo,
    webhook: true,
    webhookFilters: [
      codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH)
        .andBranchIs(props.githubBranch || 'main'),
    ],
  });
}
```

### 2. ビルド環境設定 (`createBuildEnvironment`)
**目的**: コンテナイメージとコンピュートリソースの設定
```typescript
private createBuildEnvironment(): codebuild.BuildEnvironment {
  return {
    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    privileged: true,
    computeType: codebuild.ComputeType.SMALL,
  };
}
```

### 3. 環境変数設定 (`createEnvironmentVariables`)
**目的**: ビルド中に使用する環境変数の定義
```typescript
private createEnvironmentVariables(): { [key: string]: codebuild.BuildEnvironmentVariable } {
  return {
    AWS_DEFAULT_REGION: { value: this.region },
    AWS_ACCOUNT_ID: { value: this.account },
    IMAGE_REPO_NAME: { value: this.ecrRepository.repositoryName },
  };
}
```

### 4. ビルド仕様設定 (`createBuildSpecification`)
**目的**: ビルドプロセスの定義（外部ファイル使用）
```typescript
private createBuildSpecification(): codebuild.BuildSpec {
  // 外部buildspec.ymlファイルを使用（保守性向上）
  return codebuild.BuildSpec.fromSourceFilename('buildspec.yml');
}
```

## 外部BuildSpecファイルの利点

### `buildspec.yml`を分離する理由

1. **可読性向上**: YAMLファイルでビルドプロセスが明確
2. **保守性**: TypeScriptコードとビルドロジックの分離
3. **再利用性**: 他のプロジェクトでも使用可能
4. **バージョン管理**: ビルドプロセスの変更履歴が追跡可能
5. **チーム開発**: DevOpsエンジニアがCDKコードを変更せずにビルドプロセスを調整可能

### buildspec.ymlの特徴

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login...

  build:
    commands:
      - echo Building the Docker image...
      - docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .

  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push $REPOSITORY_URI:$IMAGE_TAG

artifacts:
  files:
    - imagedefinitions.json

cache:
  paths:
    - '/root/.docker/**/*'  # Dockerキャッシュで高速化
```

## メソッドの役割分担

| メソッド | 責任 | 戻り値 | 変更頻度 |
|---------|------|--------|----------|
| `createEcrRepository` | ECRリポジトリ作成 | `ecr.Repository` | 低 |
| `createSourceConfiguration` | GitHubソース設定 | `codebuild.Source` | 中 |
| `createBuildEnvironment` | ビルド環境設定 | `codebuild.BuildEnvironment` | 低 |
| `createEnvironmentVariables` | 環境変数設定 | `BuildEnvironmentVariable[]` | 中 |
| `createBuildSpecification` | ビルド仕様設定 | `codebuild.BuildSpec` | 高 |
| `createCodeBuildProject` | 全体の組み立て | `codebuild.Project` | 低 |

## 拡張性とカスタマイズ

### 環境別設定の例

```typescript
private createBuildEnvironment(environment: string): codebuild.BuildEnvironment {
  const baseConfig = {
    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    privileged: true,
  };

  if (environment === 'prod') {
    return {
      ...baseConfig,
      computeType: codebuild.ComputeType.MEDIUM, // 本番は高性能
    };
  }

  return {
    ...baseConfig,
    computeType: codebuild.ComputeType.SMALL, // 開発は低コスト
  };
}
```

### 複数ソース対応の例

```typescript
private createSourceConfiguration(sourceType: 'github' | 'codecommit', props: any) {
  switch (sourceType) {
    case 'github':
      return codebuild.Source.gitHub(props.github);
    case 'codecommit':
      return codebuild.Source.codeCommit(props.codecommit);
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}
```

## テストとデバッグ

### 個別コンポーネントのテスト
分離されたメソッドにより、各設定を個別にテスト可能：

```typescript
// 単体テストの例
describe('EcsCicdStack', () => {
  test('creates correct source configuration', () => {
    const stack = new EcsCicdStack(app, 'TestStack', props);
    const sourceConfig = stack.createSourceConfiguration(props);
    expect(sourceConfig).toHaveProperty('owner', 'test-owner');
  });
});
```

### デバッグの容易さ
問題が発生した際、特定の設定メソッドに絞って調査可能：

```bash
# ビルド環境のみの確認
npx cdk synth --no-staging | grep -A 10 "BuildEnvironment"

# 環境変数のみの確認
npx cdk synth --no-staging | grep -A 5 "Environment"
```

この構造により、コードの理解、保守、拡張が大幅に改善されます。