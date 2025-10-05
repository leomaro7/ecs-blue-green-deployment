# Capacity Provider 設定の依存関係

## 重要: 両方の設定が必要

### 誤解を解く

**❌ 誤解**: 「クラスターかサービスのどちらか一つだけ設定すれば良い」

**✅ 正解**: 「クラスター設定が前提条件、サービス設定で実際に使用」

## 依存関係の詳細

### 1. クラスター設定は「前提条件」

```typescript
// これがないと FARGATE_SPOT は使用できない
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  enableFargateCapacityProviders: true,  // 👈 必須の前提条件
});
```

### 2. サービス設定は「実際の選択」

```typescript
// クラスター設定があって初めて、この設定が有効
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  capacityProviderStrategies: [  // 👈 クラスター設定が前提
    { capacityProvider: 'FARGATE_SPOT', weight: 1 },
  ],
});
```

## 設定パターンごとの動作

### パターン1: クラスター設定のみ（現在の状態）

```typescript
// クラスター: 有効
enableFargateCapacityProviders: true

// サービス: 設定なし
// capacityProviderStrategies なし
```

**結果:**
- ✅ 動作する
- 🎯 デフォルト戦略（FARGATE）を使用
- 💰 通常料金で動作
- 📋 選択肢は準備済み

### パターン2: サービス設定のみ（エラーになる）

```typescript
// クラスター: 無効
enableFargateCapacityProviders: false

// サービス: SPOT使用を試行
capacityProviderStrategies: [
  { capacityProvider: 'FARGATE_SPOT', weight: 1 },
]
```

**結果:**
- ❌ **デプロイエラー**
- 🚨 `FARGATE_SPOT is not associated with cluster` エラー
- 💥 スタック作成失敗

### パターン3: 両方設定（正しい使用方法）

```typescript
// クラスター: 選択肢を有効化
enableFargateCapacityProviders: true

// サービス: 実際の戦略選択
capacityProviderStrategies: [
  { capacityProvider: 'FARGATE_SPOT', weight: 1 },
]
```

**結果:**
- ✅ 正常動作
- 💰 Spot料金で実行（最大70%削減）
- ⚠️ 中断リスクあり

## 実際のエラー例

### クラスター設定なしでサービス設定した場合

```bash
# デプロイ時のエラーメッセージ
CREATE_FAILED | AWS::ECS::Service | ApacheService
Capacity provider 'FARGATE_SPOT' is not associated with cluster 'apache-cluster'
```

### 正しい修正方法

```typescript
// Step 1: クラスターでCapacity Providers有効化
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  enableFargateCapacityProviders: true,  // 👈 まずこれが必要
});

// Step 2: サービスで戦略選択
const service = new ecs.FargateService(this, 'ApacheService', {
  capacityProviderStrategies: [          // 👈 Step 1があって初めて有効
    { capacityProvider: 'FARGATE_SPOT', weight: 1 },
  ],
});
```

## なぜ2段階必要なのか？

### 1. **セキュリティと管理**

```typescript
// クラスター管理者が制御
enableFargateCapacityProviders: true  // 「SPOT使用を許可する」

// 開発者が選択
capacityProviderStrategies: [...]      // 「実際にSPOTを使用する」
```

### 2. **AWS APIの仕様**

```bash
# AWS ECS の仕様
1. クラスターにCapacity Providersを関連付け
2. サービスがクラスターのCapacity Providersから選択
```

### 3. **柔軟性**

```typescript
// 1つのクラスターで複数の戦略
const webService = new ecs.FargateService(this, 'Web', {
  capacityProviderStrategies: [
    { capacityProvider: 'FARGATE', weight: 1 },  // 安定性重視
  ],
});

const batchService = new ecs.FargateService(this, 'Batch', {
  capacityProviderStrategies: [
    { capacityProvider: 'FARGATE_SPOT', weight: 1 },  // コスト重視
  ],
});
```

## 段階的な実装アプローチ

### フェーズ1: クラスター準備（現在 - 推奨継続）

```typescript
// 選択肢だけ準備、実際の使用はしない
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  enableFargateCapacityProviders: true,  // 👈 準備
});

const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  // capacityProviderStrategies なし = デフォルト使用
});
```

**メリット:**
- ✅ 既存動作に影響なし
- ✅ 将来のSpot使用準備完了
- ✅ いつでもサービス設定を追加可能

### フェーズ2: Spot使用開始（将来）

```typescript
// クラスター設定はそのまま

// サービス設定を追加
const service = new ecs.FargateService(this, 'ApacheService', {
  cluster: this.cluster,
  capacityProviderStrategies: [  // 👈 追加
    { capacityProvider: 'FARGATE_SPOT', weight: 1 },
  ],
});
```

## 現在のプロジェクトでの推奨

### ✅ 現在の設定を維持

```typescript
// 現在の状態（推奨継続）
this.cluster = new ecs.Cluster(this, 'ApacheCluster', {
  enableFargateCapacityProviders: true,  // ✅ 良い設定
});

// サービス設定なし = デフォルト使用
// これで通常FARGATEで安定動作
```

### 🔄 将来Spotを使いたい場合

```typescript
// 現在のクラスター設定はそのまま活用

// サービスにのみ追加
capacityProviderStrategies: [
  { capacityProvider: 'FARGATE_SPOT', weight: 1 },
]
```

## まとめ

### 設定の役割

| 設定レベル | 役割 | 必要性 | 現在の状態 |
|-----------|------|--------|-----------|
| **クラスター** | 「許可・準備」 | 必須（前提条件） | ✅ 設定済み |
| **サービス** | 「実際の選択」 | オプション | ❌ 未設定（デフォルト使用） |

### 正しい理解

```typescript
// ✅ 両方必要な関係
enableFargateCapacityProviders: true     // 「SPOT を使えるようにする」
capacityProviderStrategies: [...]        // 「実際に SPOT を使う」

// ❌ どちらか一つではダメ
// クラスター設定なし + サービス設定あり = エラー
// クラスター設定あり + サービス設定なし = デフォルト動作
```

**結論**: クラスター設定は「前提条件」、サービス設定は「実際の選択」です。現在の設定（クラスターのみ）で将来への準備は完了しており、必要に応じてサービスレベルで戦略を追加できます！