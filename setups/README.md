# セットアップガイド

macOS 上で sbx 内の Claude Code を管理するためのセットアップ手順。

## 前提

- macOS
- Docker インストール済み
- sbx CLI インストール済み

## 1. アプリのインストール

[Releases](https://github.com/shshimamo/claude-sbx/releases) から `.dmg` をダウンロードしてインストール。

## 2. 初回起動

アプリを起動すると `~/.claude-sbx/` に以下が自動生成される:

| ファイル | 説明 |
|----------|------|
| `config.json` | 設定ファイル |
| `Dockerfile` | sbx テンプレート用 Dockerfile |

必要に応じて編集（設定項目は [README.md](../README.md#configjson) を参照）。

## 3. sbx テンプレートのビルド（初回のみ）

1. サイドバーの **Dockerfile** ボタンをクリック
2. Dockerfile を確認（デフォルトのままでも動作する）
3. **ビルド & ロード** ボタンをクリック

内部で以下が実行される:
```
docker build -t my-sbx:latest -f ~/.claude-sbx/Dockerfile ~/.claude-sbx/
docker save my-sbx:latest -o <tmpfile>
sbx template load <tmpfile>
```

テンプレートを変更したい場合は Dockerfile を編集して再度ビルドするだけ。

## 4. 使い方

1. **sbx 管理**: サイドバーの「sbx 管理」ボタンで sbx を作成
2. **新規セッション**: 「+」ボタンで sbx とリポジトリを選択し、Claude を起動
   - **Existing repo**: sbx 内の既存リポジトリを選択
   - **New worktree**: ブランチ名や PR Link を入力して Worktree を作成

以降はアプリ内のターミナルで Claude を直接操作できる。

## カスタマイズ

### post_create_cmds

sbx 作成後に自動実行するコマンドを設定可能。参考: [`sbx-setup.sh`](sbx-setup.sh)

```json
{
  "sbx": {
    "post_create_cmds": [["~/src/claude-sbx/setups/sbx-setup.sh"]]
  }
}
```

### 設定ファイルの参考例

[`examples/`](../examples/) に `config.json` と `sbx-setup.sh` の参考例がある。
