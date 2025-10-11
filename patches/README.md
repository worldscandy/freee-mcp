# Patches for freee-mcp

このディレクトリには、upstreamにPR中またはマージ待ちの変更をpatchとして管理しています。

## 管理中のパッチ

| Patch | 説明 | worldscandy PR | upstream PR | Status |
|-------|------|----------------|-------------|--------|
| 0001-Fix-MCP-schema-validation-error-by-sanitizing-proper.patch | MCP schema validation error修正：OpenAPI property名のサニタイズ処理 | #1 | - | 未提出（要検証） |
| 0002-Enhance-authentication-documentation-with-detailed-s.patch | 認証ドキュメント強化：詳細なセットアップガイドとトラブルシューティング追加 | - | - | ドキュメントのみ |
| 0003-Fix-Issue-4-Binary-response-endpoints-and-MCP-schema.patch | Issue #4対応：バイナリレスポンス対応 + MCP schema validation改善 | - | - | 未提出（要検証） |
| 0004-feat-Add-file-save-functionality-for-binary-download.patch | バイナリダウンロードのファイル保存機能追加 | #2 | - | 未提出（要検証） |

## upstream情報

- upstream repository: https://github.com/him0/freee-mcp
- 最終同期: v0.2.4 (commit 164e555)
- 重要なupstream変更:
  - **80ccb75**: 動的ポート割り当て機能（OAuth callback server） - 認証問題の改善

## パッチ適用方法

eijuworks-mainブランチを再構築：

```bash
./scripts/update-eijuworks.sh
```

または手動で：

```bash
git checkout main
git checkout -b eijuworks-main-new
git am patches/*.patch
git branch -D eijuworks-main
git branch -m eijuworks-main-new eijuworks-main
git push origin eijuworks-main --force
```

## パッチ生成方法

新しい機能をupstreamにPRとして提出する場合：

```bash
# 1. feature branchで作業
git checkout main
git checkout -b feature/new-feature
# ... 修正作業 ...
git commit -m "fix: description"

# 2. upstream PRを作成
git push origin feature/new-feature
# GitHub上でhim0/freee-mcp へPRを作成

# 3. patchを生成
git format-patch main..feature/new-feature -o patches/
mv patches/0001-*.patch patches/000X-new-feature.patch

# 4. patches/README.mdを更新（PR番号を記載）

# 5. eijuworks-mainに反映
./scripts/update-eijuworks.sh
```

## PRマージ後のクリーンアップ

upstream PRがマージされた後：

```bash
# 1. mainを最新に更新
git checkout main
git fetch upstream
git reset --hard upstream/main
git push origin main --force

# 2. 該当patchを削除
rm patches/000X-merged-feature.patch

# 3. patches/README.mdを更新

# 4. eijuworks-mainを再構築
./scripts/update-eijuworks.sh
```

## 注意事項

- **パッチの順序**: patchファイル名の番号順に適用されます
- **コンフリクト**: upstream更新時にpatch適用が失敗した場合は、該当patchを手動で修正してください
- **検証**: 各patchは適用後にテストを実行して動作確認してください
- **upstream PR**: 検証完了後、積極的にupstreamへPRを送ることを推奨します

## テスト方法

```bash
# 型チェック
pnpm type-check

# リント
pnpm lint

# テスト実行
pnpm test:run

# ビルド確認
pnpm build
```
