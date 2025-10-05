# Cloud Map 名前空間作成戦略の比較

## 3つのアプローチ比較

### アプローチ1: 名前空間なし
```typescript
// 名前空間を作成しない
const cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  vpc: this.vpc,
  // defaultCloudMapNamespace なし
});
```

### アプローチ2: 名前空間のみ作成（推奨）
```typescript
// Cloud Map名前空間のみ作成、Service Connectはデフォルト無効
const cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  vpc: this.vpc,
  defaultCloudMapNamespace: {
    name: 'apache.local',
    useForServiceConnect: false,  // 👈 デフォルト無効
    vpc: this.vpc,
  },
});
```

### アプローチ3: Service Connect デフォルト有効
```typescript
// Cloud Map名前空間作成 + Service Connectデフォルト有効
const cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  vpc: this.vpc,
  defaultCloudMapNamespace: {
    name: 'apache.local',
    useForServiceConnect: true,   // 👈 デフォルト有効
    vpc: this.vpc,
  },
});
```

## 各アプローチの詳細比較

| 観点 | 名前空間なし | 名前空間のみ | Service Connect有効 |
|------|-------------|-------------|-------------------|
| **Cloud Map名前空間** | ❌ 作成されない | ✅ 作成される | ✅ 作成される |
| **Service Connect準備** | ❌ 未準備 | ✅ 準備済み | ✅ 準備済み |
| **デフォルト設定** | ❌ なし | ❌ なし | ✅ あり |
| **将来の移行** | 🔄 スタック更新必要 | 🔄 設定変更のみ | ✅ 即座に使用可能 |
| **現在への影響** | ✅ なし | ✅ なし | ✅ なし |
| **追加コスト** | ✅ なし | ⚠️ 微小（名前空間維持費） | ⚠️ 微小（名前空間維持費） |

## アプローチ2が推奨される理由

### ✅ **最適なバランス**

```typescript
defaultCloudMapNamespace: {
  name: 'apache.local',
  useForServiceConnect: false,  // 現在は無効
  vpc: this.vpc,
}
```

**メリット:**
1. **現在**: 影響なし、シンプル
2. **将来**: 簡単にService Connect有効化可能
3. **コスト**: 名前空間維持費のみ（月数円）
4. **柔軟性**: 必要な時にのみ有効化

### 🔄 **将来の有効化が簡単**

Service Connectが必要になった時：

```typescript
// ステップ1: useForServiceConnect を true に変更
useForServiceConnect: true,

// ステップ2: サービスでService Connect使用
serviceConnectConfiguration: {
  // 名前空間は自動継承
  services: [...],
}
```

## 実際のCloudFormation出力

### アプローチ2（名前空間のみ）の場合

```yaml
# CloudFormation Template
ApacheCluster:
  Type: AWS::ECS::Cluster
  Properties:
    ClusterName: apache-cluster
    # ServiceConnectDefaults なし（デフォルト無効）

ApacheLocalNamespace:
  Type: AWS::ServiceDiscovery::HttpNamespace
  Properties:
    Name: apache.local
    Vpc: !Ref ApacheVpc
    # Service Connect対応可能な名前空間として作成
```

### アプローチ3（Service Connect有効）の場合

```yaml
# CloudFormation Template
ApacheCluster:
  Type: AWS::ECS::Cluster
  Properties:
    ClusterName: apache-cluster
    ServiceConnectDefaults:          # デフォルト設定あり
      Namespace: !GetAtt ApacheLocalNamespace.Arn

ApacheLocalNamespace:
  Type: AWS::ServiceDiscovery::HttpNamespace
  Properties:
    Name: apache.local
    Vpc: !Ref ApacheVpc
```

## 移行パスの比較

### アプローチ1から移行する場合
```bash
# 名前空間なし → Service Connect使用
1. CDKコード変更（名前空間追加）
2. スタックデプロイ
3. サービス更新（Service Connect設定）
4. アプリケーション再デプロイ
```

### アプローチ2から移行する場合
```bash
# 名前空間のみ → Service Connect使用
1. CDKコード変更（useForServiceConnect: true）
2. スタックデプロイ
3. サービス更新（Service Connect設定）
```

### アプローチ3の場合
```bash
# すでに準備完了
1. サービス更新（Service Connect設定）のみ
```

## コスト分析

### Cloud Map名前空間の料金

```bash
# AWS Cloud Map の料金（2024年現在）
- 名前空間: $0.50/月 per hosted zone
- クエリ: $0.40 per million queries

# 実際のコスト例
名前空間のみ: ~$0.50/月
使用していないService Connect: $0
```

**結論**: 名前空間維持費は月数十円程度で、将来の柔軟性を考えると十分価値があります。

## 具体的な実装例

### 現在の推奨設定

```typescript
export class EcsApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: EcsApplicationStackProps) {
    super(scope, id, props);

    // アプローチ2: 名前空間のみ作成
    this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
      clusterName: 'apache-cluster',
      vpc: this.vpc,
      defaultCloudMapNamespace: {
        name: 'apache.local',
        useForServiceConnect: false,  // 現在は無効
        vpc: this.vpc,
      },
    });

    // 現在のサービス（Service Connect未使用）
    this.service = new ecs.FargateService(this, 'ApacheService', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      // serviceConnectConfiguration なし
    });
  }
}
```

### 将来のService Connect有効化

```typescript
// 将来必要になった時の変更例
export class EcsApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: EcsApplicationStackProps) {
    super(scope, id, props);

    // Step 1: Service Connectデフォルト有効化
    this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
      clusterName: 'apache-cluster',
      vpc: this.vpc,
      defaultCloudMapNamespace: {
        name: 'apache.local',
        useForServiceConnect: true,   // 👈 変更
        vpc: this.vpc,
      },
    });

    // Step 2: タスク定義でポート名追加
    this.taskDefinition.addContainer('ApacheContainer', {
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
          name: 'http',  // 👈 追加
        },
      ],
    });

    // Step 3: サービスでService Connect設定
    this.service = new ecs.FargateService(this, 'ApacheService', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      serviceConnectConfiguration: {  // 👈 追加
        services: [
          {
            portMappingName: 'http',
            discoveryName: 'apache',
          },
        ],
      },
    });
  }
}
```

## 推奨結論

### 🎯 **アプローチ2（名前空間のみ）を強く推奨**

```typescript
defaultCloudMapNamespace: {
  name: 'apache.local',
  useForServiceConnect: false,  // 👈 この設定がベスト
  vpc: this.vpc,
}
```

**理由:**
1. **現在**: シンプルで影響なし
2. **将来**: 簡単にService Connect移行可能
3. **コスト**: 最小限（月数十円）
4. **柔軟性**: 必要な時のみ有効化
5. **学習**: 段階的な機能習得が可能

この設定で将来への準備と現在のシンプルさを両立できます！