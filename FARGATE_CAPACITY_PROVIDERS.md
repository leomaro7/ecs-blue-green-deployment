# Fargate Capacity Providers の詳細解説

## `enableFargateCapacityProviders: true` の効果

### 設定の違い

**❌ `enableFargateCapacityProviders: false` (デフォルト)**
```typescript
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  // enableFargateCapacityProviders: false (デフォルト)
});
```

**✅ `enableFargateCapacityProviders: true`**
```typescript
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  enableFargateCapacityProviders: true,  // 👈 有効化
});
```

## Capacity Providers とは？

**Capacity Providers** は、ECSクラスターでタスクを実行するためのコンピュートリソースの管理方法を定義する機能です。

### 利用可能なFargateタイプ

1. **FARGATE**: 通常のFargateタスク
2. **FARGATE_SPOT**: Spot料金で実行されるFargateタスク（最大70%割引）

## 有効化による変化

### CloudFormation での違い

**❌ 無効時**
```yaml
ApacheCluster:
  Type: AWS::ECS::Cluster
  Properties:
    ClusterName: apache-cluster
    # CapacityProviders なし
```

**✅ 有効時**
```yaml
ApacheCluster:
  Type: AWS::ECS::Cluster
  Properties:
    ClusterName: apache-cluster
    CapacityProviders:           # 👈 自動追加
      - FARGATE
      - FARGATE_SPOT
    DefaultCapacityProviderStrategy:  # 👈 デフォルト戦略
      - CapacityProvider: FARGATE
        Weight: 1
        Base: 0
```

## 実用的なメリット

### 1. **Fargate Spot の利用が可能**

```typescript
// サービス作成時にSpotを指定可能
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE_SPOT',  // 👈 Spot使用
      weight: 1,
    },
  ],
});
```

### 2. **混合戦略の実装**

```typescript
// 通常Fargateと Spot の混合使用
capacityProviderStrategies: [
  {
    capacityProvider: 'FARGATE',      // 安定性重視
    weight: 1,
    base: 1,  // 最低1タスクは通常Fargate
  },
  {
    capacityProvider: 'FARGATE_SPOT', // コスト重視
    weight: 3,  // 残りの75%はSpot
  },
],
```

### 3. **コスト最適化**

| タイプ | 料金 | 中断リスク | 用途 |
|--------|------|-----------|------|
| **FARGATE** | 標準料金 | なし | 本番重要サービス |
| **FARGATE_SPOT** | 最大70%割引 | あり | 開発・テスト環境 |

## 現在のサービスへの影響

### 設定なしの場合（現在）

```typescript
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  // capacityProviderStrategies 指定なし
});
```

**動作:**
- ✅ **デフォルトFARGATE**: 通常のFargateで動作
- ✅ **影響なし**: 既存の動作は変わらない
- ✅ **選択肢追加**: 将来Spotを選択可能

### Spotを使用する場合

```typescript
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE_SPOT',
      weight: 1,
    },
  ],
});
```

## Fargate Spot の特徴

### ✅ メリット

1. **大幅なコスト削減**: 最大70%の料金削減
2. **同一機能**: 通常Fargateと同じ機能
3. **自動スケーリング**: Auto Scalingも対応
4. **簡単移行**: 設定変更のみで利用可能

### ⚠️ 注意点

1. **中断リスク**: AWSが容量を必要とする時に中断される可能性
2. **可用性**: 通常Fargateより可用性が低い場合がある
3. **予測困難**: 中断タイミングは予測不可能

### 中断時の動作

```bash
# Spot中断時の流れ
1. AWS が2分前に中断通知
2. ECS が新しいタスクを起動開始
3. 古いタスクは graceful shutdown
4. ヘルスチェック通過後にトラフィック切り替え
```

## 実用的な使用パターン

### パターン1: 開発環境でのコスト削減

```typescript
// 開発環境設定例
const devService = new ecs.FargateService(this, 'ApacheDevService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE_SPOT',  // 開発はSpotでコスト削減
      weight: 1,
    },
  ],
});
```

### パターン2: 本番環境での混合戦略

```typescript
// 本番環境での混合戦略
const prodService = new ecs.FargateService(this, 'ApacheProdService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE',      // 安定性のベース
      weight: 1,
      base: 2,  // 最低2タスクは通常Fargate
    },
    {
      capacityProvider: 'FARGATE_SPOT', // コスト削減
      weight: 1,  // 追加分はSpot
    },
  ],
});
```

### パターン3: 環境別の動的設定

```typescript
export class EcsApplicationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: EcsApplicationStackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') || 'dev';

    // 環境別のCapacity Provider戦略
    const capacityStrategy = this.getCapacityStrategy(environment);

    const service = new ecs.FargateService(this, 'ApacheService', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      capacityProviderStrategies: capacityStrategy,
    });
  }

  private getCapacityStrategy(environment: string) {
    switch (environment) {
      case 'prod':
        return [
          { capacityProvider: 'FARGATE', weight: 2, base: 1 },
          { capacityProvider: 'FARGATE_SPOT', weight: 1 },
        ];
      case 'staging':
        return [
          { capacityProvider: 'FARGATE', weight: 1, base: 1 },
          { capacityProvider: 'FARGATE_SPOT', weight: 2 },
        ];
      default: // dev
        return [
          { capacityProvider: 'FARGATE_SPOT', weight: 1 },
        ];
    }
  }
}
```

## コスト計算例

### 月間コスト比較（ap-northeast-1リージョン）

```bash
# 前提: 2 vCPU, 4GB, 24時間/日 × 30日

# 通常 Fargate
vCPU: $0.05056 × 2 × 24 × 30 = $72.8
メモリ: $0.00553 × 4 × 24 × 30 = $15.9
合計: $88.7/月

# Fargate Spot (70%割引)
合計: $88.7 × 0.3 = $26.6/月

# 節約額: $62.1/月 (70%削減)
```

## 推奨設定

### 現在のプロジェクトでの推奨

```typescript
// クラスター設定: 有効にしておく
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  clusterName: 'apache-cluster',
  enableFargateCapacityProviders: true,  // 👈 有効化推奨
});

// サービス設定: 環境に応じて選択
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  taskDefinition: this.taskDefinition,
  // 開発時: FARGATE_SPOT でコスト削減
  // 本番時: デフォルト（FARGATE）で安定性重視
});
```

### 段階的な導入

```bash
# フェーズ1: Capacity Providers 有効化（現在）
enableFargateCapacityProviders: true

# フェーズ2: 開発環境でSpot試用
capacityProviderStrategies: [FARGATE_SPOT]

# フェーズ3: 本番環境で混合戦略
capacityProviderStrategies: [FARGATE + FARGATE_SPOT]
```

## まとめ

### `enableFargateCapacityProviders: true` の効果

✅ **現在への影響**: なし（デフォルトはFARGATE）
✅ **将来の選択肢**: FARGATE_SPOTが利用可能
✅ **コスト削減**: 最大70%の料金削減可能
✅ **柔軟性**: 環境別・用途別の戦略選択
✅ **設定コスト**: 追加料金なし

**結論**: 有効にしておくことで選択肢が広がり、特にデメリットがないため設定推奨です！