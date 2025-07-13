# MCP テストスクリプト使い方ガイド

## 概要

freee MCP サーバーの動作確認用スクリプトです。2つのバージョンを提供しています：

1. **test-mcp-simple.js** (推奨): Claude Code 向け最適化版
2. **test-mcp.js** (従来版): 完全な動作確認版

## test-mcp-simple.js (推奨)

Claude Code での使用に最適化された軽量・高速版です。

### ヘルプ表示

```bash
# 詳細な使用例を表示
node scripts/test-mcp-simple.js --help
node scripts/test-mcp-simple.js -h

# バージョン情報
node scripts/test-mcp-simple.js --version
```

### 実行方法

#### コマンドライン実行（一回だけ）- 推奨
```bash
# 基本ツール
node scripts/test-mcp-simple.js freee_current_user
node scripts/test-mcp-simple.js freee_auth_status
node scripts/test-mcp-simple.js freee_list_companies

# データ取得
node scripts/test-mcp-simple.js get_deals limit=5
node scripts/test-mcp-simple.js get_receipts start_date=2025-01-01 end_date=2025-12-31 limit=3
node scripts/test-mcp-simple.js get_companies

# バイナリダウンロード
node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789
node scripts/test-mcp-simple.js get_journals_reports_by_id_download id=987654321

# 仕訳帳生成 → ダウンロード
node scripts/test-mcp-simple.js get_journals download_type=pdf start_date=2025-01-01 end_date=2025-03-31
```

#### インタラクティブモード
```bash
node scripts/test-mcp-simple.js

# インタラクティブモード内で利用可能なコマンド:
# > help    - 詳細な使用例を表示
# > exit    - 終了
# > freee_current_user
# > get_deals limit=5
```

### 改善点
- ✅ 冗長な事前テスト削除（高速起動）
- ✅ エラーハンドリング強化（readline競合状態解決）
- ✅ レスポンス表示最適化（長文は要約）
- ✅ コマンドライン引数対応
- ✅ ヘルプ機能内蔵（--help、インタラクティブモード内help）
- ✅ 適切な終了処理

## test-mcp.js (従来版)

完全な動作確認用で、事前テストも含まれます。

### 動作フロー
1. **MCP サーバー起動**: `pnpm tsx src/index.ts` でサーバーを起動
2. **初期化**: MCP プロトコルで initialize  
3. **ツール一覧取得**: 利用可能な全ツールを表示
4. **事前テスト**: 基本的なツール（`freee_status`, `freee_auth_status` など）を自動実行
5. **インタラクティブモード**: ユーザーが任意のツールを手動テスト

### 使い方
```bash
node scripts/test-mcp.js
```

## パラメータ形式

### key=value 形式
```bash
get_receipts start_date=2025-01-01 end_date=2025-12-31 limit=3
get_deals limit=5
```

### JSON 形式（インタラクティブモードのみ）
```bash
get_receipts {"start_date":"2025-01-01","end_date":"2025-12-31","limit":3}
```

### 対応している型変換
- **文字列**: そのまま文字列として扱う
- **整数**: `123` → `123` (number)
- **小数**: `12.34` → `12.34` (number)
- **JSON**: 完全なJSONオブジェクトをパース

## Claude Code での推奨使用手順

```bash
# 1. 認証状態確認
node scripts/test-mcp-simple.js freee_auth_status

# 2. データ取得テスト
node scripts/test-mcp-simple.js get_deals limit=5

# 3. バイナリダウンロードテスト
node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789
```

## 主要な利用可能ツール

### 認証・管理ツール（パラメータ不要）
- `freee_current_user` - 現在のユーザー情報とAPI動作確認
- `freee_auth_status` - 認証状態の詳細確認
- `freee_list_companies` - 事業所一覧（実API呼び出し）
- `freee_get_current_company` - 現在の事業所情報
- `freee_status` - システム全体の状態確認
- `freee_help` - 使い方ガイド

### freee API ツール（パラメータが必要な場合あり）
- `get_companies` - 事業所一覧取得
- `get_users_me` - ユーザー情報取得
- `get_deals` - 取引一覧取得
- `get_receipts` - レシート一覧取得（start_date, end_date 必須）
- `get_receipts_by_id_download` - レシートダウンロード（バイナリ）
- `get_journals_reports_by_id_download` - 仕訳帳ダウンロード（バイナリ）

## バイナリダウンロードのテスト手順

### 1. レシートダウンロード
```bash
# レシート一覧を取得してIDを確認
node scripts/test-mcp-simple.js get_receipts start_date=2025-01-01 end_date=2025-12-31

# 取得したIDでバイナリダウンロード
node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789
```

### 2. 仕訳帳ダウンロード
```bash
# 仕訳帳ダウンロードリクエスト
node scripts/test-mcp-simple.js get_journals download_type=pdf start_date=2025-01-01 end_date=2025-03-31

# 受け付けIDでダウンロード
node scripts/test-mcp-simple.js get_journals_reports_by_id_download id=987654321
```

### 期待結果
```
Binary data downloaded successfully (XXX bytes).
Base64: data:application/octet-stream;base64,...

📊 総文字数: XXXXX 文字
```

## トラブルシューティング

### 認証エラーの場合
```bash
node scripts/test-mcp-simple.js freee_authenticate  # 再認証
node scripts/test-mcp-simple.js freee_auth_status   # 状態確認
```

### ヘルプが必要な場合
```bash
# コマンドライン
node scripts/test-mcp-simple.js --help

# インタラクティブモード内
> help
```

### パラメータエラーの場合
- ヘルプで正しいパラメータ形式を確認
- または MCP Inspector (`pnpm inspector`) を使用してGUI でパラメータを指定

## テスト方法の比較

| 方法 | 用途 | 特徴 |
|------|------|------|
| `test-mcp-simple.js` (CLI) | 日常開発、CI/CD | 高速、ワンライナー実行、Claude Code最適 |
| `test-mcp.js` (CLI) | 完全な動作確認 | 事前テスト付き、詳細ログ |
| `pnpm inspector` (GUI) | 初回確認、複雑なパラメータ | ブラウザ、パラメータ入力支援 |

## Issue #4 バイナリダウンロード修正の確認

今回の修正により、以下が正常に動作するようになりました：

### ✅ 修正内容
1. **`makeApiRequest()`** - Content-Type に基づくバイナリレスポンス処理
2. **OpenAPI ツール** - ArrayBuffer の Base64 変換
3. **ダウンロード系ツール** - PDF/画像ファイルの正常な取得

### ✅ 動作確認済み
- **レシートダウンロード**: JPEG画像形式対応
- **仕訳帳ダウンロード**: PDF形式対応 
- **通常APIテスト**: 取引データ5件取得

### 推奨テスト手順
```bash
# 1. バイナリダウンロード確認
node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789

# 2. 通常API確認  
node scripts/test-mcp-simple.js get_deals limit=5

# 3. 認証状態確認
node scripts/test-mcp-simple.js freee_auth_status
```

全ての機能が正常に動作していることが確認済みです。

## 注意事項

- **実際のAPI呼び出し**: このスクリプトは実際の freee API を呼び出します
- **認証必須**: `~/.config/freee-mcp/tokens.json` に有効な認証トークンが必要
- **事業所データ**: 現在設定されている事業所のデータを使用
- **レート制限**: freee API のレート制限に注意（特に `/receipts/{id}/download` は1秒に3回まで）