# セットアップガイド

macOS 上で sbx 内の Claude Code を管理するためのセットアップ手順。

## 前提

- macOS
- sbx CLI インストール済み
- Docker（`template` 設定時のみ）
- git インストール済み
- gh（PR Link から Worktree 作成機能利用時のみ）

## 1. アプリのインストール

[Releases](https://github.com/shshimamo/claude-sbx/releases) から `.dmg` をダウンロードしてインストール。

コード署名がないため、初回は Gatekeeper を解除する:

```sh
xattr -cr /Applications/Claude\ Sbx.app
```

## 2. 初回起動

アプリを起動すると `~/.claude-sbx/` に以下が自動生成される:

| ファイル | 説明 |
|----------|------|
| `config.json` | 設定ファイル |
| `Dockerfile` | sbx テンプレート用 Dockerfile |

歯車メニュー > **Config** から設定を編集可能（設定項目は [README.md](../README.md#configjson) を参照）。

## 3. 使い方

1. **sbx 管理**: 歯車メニュー > 「sbx 管理」で sbx を作成
2. **新規セッション**: 「+」ボタンで sbx とリポジトリを選択し、Claude を起動
   - **Existing repo**: sbx 内の既存リポジトリを選択
   - **New worktree**: ブランチ名や PR Link を入力して Worktree を作成
   - **Shell**: zsh / bash で sbx に直接入る

以降はアプリ内のターミナルで Claude を直接操作できる。

## カスタマイズ

歯車メニュー > **Config** から設定を編集できる。詳細は [`examples/config.json`](../examples/config.json) を参照。

| キー | 用途 |
|------|------|
| `sbx.post_create_cmds` | sbx 作成後にコマンドを実行したい場合 |
| `sbx.plugins` | Claude plugins を設定したい場合 |
| `sbx.kits` | kits を設定したい場合 |
| `sbx.template` | カスタムテンプレートを使いたい場合（Docker 必要） |
| `sbx.mounts` | `clone_base` / `worktree_base` 以外をマウントしたい場合 |
