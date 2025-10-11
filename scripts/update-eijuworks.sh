#!/bin/bash
#
# eijuworks-mainブランチを再構築するスクリプト
# mainブランチにpatchesディレクトリ内のパッチを順番に適用します
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PATCHES_DIR="$REPO_ROOT/patches"

echo "=== eijuworks-main 再構築スクリプト ==="
echo

# 現在のブランチを確認
CURRENT_BRANCH=$(git branch --show-current)
echo "現在のブランチ: $CURRENT_BRANCH"
echo

# mainブランチに切り替え
echo "[Step 1] mainブランチに切り替え..."
git checkout main
echo "✓ mainブランチに切り替えました"
echo

# 一時的な作業ブランチを作成（既存があれば削除）
TEMP_BRANCH="eijuworks-main-new"
echo "[Step 2] 一時ブランチ作成: $TEMP_BRANCH"
git branch -D "$TEMP_BRANCH" 2>/dev/null || true
git checkout -b "$TEMP_BRANCH"
echo "✓ $TEMP_BRANCH を作成しました"
echo

# patchファイルを順番に適用
echo "[Step 3] パッチ適用中..."
if [ -d "$PATCHES_DIR" ] && [ "$(ls -A $PATCHES_DIR/*.patch 2>/dev/null)" ]; then
    PATCH_COUNT=0
    for patch in "$PATCHES_DIR"/*.patch; do
        if [ -f "$patch" ]; then
            echo "  適用中: $(basename "$patch")"
            if git am "$patch"; then
                PATCH_COUNT=$((PATCH_COUNT + 1))
            else
                echo "❌ パッチ適用失敗: $patch"
                echo "解決方法:"
                echo "  1. git am --abort でキャンセル"
                echo "  2. 手動で修正"
                echo "  3. git am --continue で続行"
                exit 1
            fi
        fi
    done
    echo "✓ $PATCH_COUNT 個のパッチを適用しました"
else
    echo "⚠️  patches/ ディレクトリにpatchファイルが見つかりません"
    echo "   パッチ無しでeijuworks-mainを再構築します"
fi
echo

# eijuworks-mainブランチを置き換え
echo "[Step 4] eijuworks-mainブランチを更新..."
git branch -D eijuworks-main 2>/dev/null || true
git branch -m "$TEMP_BRANCH" eijuworks-main
echo "✓ eijuworks-mainブランチを更新しました"
echo

# 確認
echo "[Step 5] 最終確認"
git log --oneline --graph main..eijuworks-main | head -20
echo

echo "=== 完了 ==="
echo
echo "次のステップ:"
echo "  1. 変更内容を確認: git log main..eijuworks-main"
echo "  2. テスト実行: pnpm type-check && pnpm lint && pnpm test:run"
echo "  3. リモートにpush: git push origin eijuworks-main --force"
echo
echo "注意: force pushが必要です"
