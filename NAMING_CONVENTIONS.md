# 命名規則 (Naming Conventions)

## 統一された命名ルール

### 基本原則
- **ID (Construct ID)**: PascalCase
- **name プロパティ**: kebab-case
- **一貫性**: IDとnameが同じ概念を表現する

### リソース別命名一覧

| リソース種別 | Construct ID | name プロパティ | 説明 |
|-------------|-------------|----------------|-----|
| **VPC** | `ApacheVpc` | - | Apache用のVPC |
| **ECS Cluster** | `ApacheCluster` | `apache-cluster` | Apache用ECSクラスター |
| **Load Balancer** | `ApacheLoadBalancer` | `apache-load-balancer` | Apache用ALB |
| **Target Group (Blue)** | `ApacheBlueTargetGroup` | `apache-blue-target-group` | Blue環境用ターゲットグループ |
| **Target Group (Green)** | `ApacheGreenTargetGroup` | `apache-green-target-group` | Green環境用ターゲットグループ |
| **ALB Listener** | `ApacheListener` | - | Apache用リスナー |
| **Log Group** | `ApacheLogGroup` | `/ecs/apache-logs` | Apache用ログ |
| **Task Definition** | `ApacheTaskDefinition` | - | Apache用タスク定義 |
| **Container** | `ApacheContainer` | - | Apache用コンテナ |
| **Security Group** | `ApacheServiceSecurityGroup` | `apache-service-security-group` | Apache用セキュリティグループ |
| **ECS Service** | `ApacheService` | `apache-service` | Apache用ECSサービス |
| **ECR Repository** | `ApacheRepository` | `apache-repository` | Apache用ECRリポジトリ |
| **CodeBuild Project** | `ApacheBuildProject` | `apache-build-project` | Apache用ビルドプロジェクト |
| **CodePipeline** | `ApachePipeline` | `apache-pipeline` | Apache用パイプライン |

### 命名の意図

#### Before (統一前)
```typescript
// 一貫性がない例
new ecr.Repository(this, 'ApacheRepository', {
  repositoryName: 'apache-blue-green', // ❌ IDと内容が異なる
});

new ecs.Cluster(this, 'BlueGreenCluster', {
  clusterName: 'blue-green-cluster', // ❌ Apache固有の名前ではない
});
```

#### After (統一後)
```typescript
// 一貫性がある例
new ecr.Repository(this, 'ApacheRepository', {
  repositoryName: 'apache-repository', // ✅ IDと一致
});

new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster', // ✅ Apache固有で分かりやすい
});
```

### メリット

1. **可読性向上**: IDと名前の対応が明確
2. **保守性向上**: リソースの特定が容易
3. **一貫性**: プロジェクト全体で統一されたルール
4. **拡張性**: 他のアプリケーション追加時の命名パターンが明確

### 実装時の注意点

- Blue/Green固有の部分は明示的に分離
- アプリケーション名（Apache）を統一的に使用
- AWS リソース制限（文字数、使用可能文字）を考慮
- 環境別（dev/prod）の命名拡張も考慮済み

### 環境別拡張例

```typescript
// 環境別命名の例
const environment = 'dev'; // or 'prod'
const clusterName = `apache-cluster-${environment}`;
// 結果: apache-cluster-dev, apache-cluster-prod
```