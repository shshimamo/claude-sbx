# claude-tabs-app

sbx 内での Claude Code 利用を制御する Electron デスクトップアプリ。

ターミナル（xterm.js + node-pty）を内蔵し、sbx 管理・Dockerfile テンプレート・Worktree 作成・複数セッション管理を GUI から操作できる。

## 機能

| カテゴリ | 機能 |
|---------|------|
| セッション管理 | sbx 内で Claude を起動、複数セッションをタブで切り替え |
| sbx 管理 | sbx の作成・削除、実行コマンドのプレビュー表示 |
| Dockerfile テンプレート | Dockerfile 編集・保存、テンプレートのビルド & ロード |
| 新規セッション | Existing repo / New worktree 切り替え |
| Worktree | ブランチサジェスト、PR Link からブランチ自動解決（`gh` 使用） |
| ターミナル | xterm.js による組み込みターミナル、sbx 内で直接操作 |

## インストール

### 配布版（利用者向け）

[Releases](https://github.com/shshimamo/claude-tabs-app/releases) から `.dmg` をダウンロードしてインストール。

初回起動時に `~/.claude-tabs/config.json` と `~/.claude-tabs/Dockerfile` が自動生成される。

詳細なセットアップ手順は [setups/](setups/) を参照。

### 開発版（開発者向け）

```sh
# 前提: mise (https://mise.jdx.dev/getting-started.html)
mise install
pnpm install
pnpm approve-builds

# 開発モード
pnpm dev

# パッケージング
pnpm build
```

## config.json

`~/.claude-tabs/config.json` で設定（初回起動時に自動生成、参考: [`examples/config.json`](examples/config.json)）。

| キー | 説明 | デフォルト |
|------|------|-----------|
| `sbx.template` | sbx テンプレート名 | `my-sbx:latest` |
| `sbx.clone_base` | リポジトリ検索・sbx マウントのベースディレクトリ | `~/src` |
| `sbx.default_mounts` | sbx 作成時の追加マウント（`~` 展開可） | `[]` |
| `sbx.kits` | sbx 作成時に適用する kit | `[]` |
| `sbx.post_create_cmds` | sbx 作成後に実行するコマンド（`[["cmd", "arg"], ...]`） | `[]` |
| `worktree.base` | Worktree 保存先 | `~/worktrees` |

## アーキテクチャ

```
[Electron Main Process]
  ├─ node-pty (シェル + sbx exec)
  ├─ SbxManager (sbx CRUD, Dockerfile, Worktree)
  ├─ SessionStore (セッション状態管理)
  └─ HookServer (Claude Code hooks 受信)
        ↓ IPC
[Electron Renderer]
  ├─ xterm.js (ターミナル表示)
  ├─ React UI (サイドバー, モーダル)
  └─ Catppuccin Mocha テーマ
```

## ディレクトリ構成

```
claude-tabs-app/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron メインプロセス、IPC ハンドラ
│   │   ├── pty-manager.ts    # PTY ライフサイクル管理
│   │   ├── sbx-manager.ts    # sbx CRUD, Dockerfile, Worktree, ブランチ一覧
│   │   ├── session-store.ts  # セッション状態管理
│   │   └── hook-server.ts    # Claude Code hooks 受信 HTTP サーバー
│   ├── preload/
│   │   └── index.ts          # Context bridge (main ↔ renderer)
│   └── renderer/
│       └── src/
│           ├── App.tsx              # メインレイアウト
│           ├── Terminal.tsx          # xterm.js ターミナル
│           ├── Sidebar.tsx           # セッション一覧 + ツールバー
│           ├── NewSessionModal.tsx   # 新規セッション（Existing repo / New worktree）
│           ├── ManageSbxModal.tsx    # sbx 管理（作成・削除）
│           ├── DockerfileModal.tsx   # Dockerfile テンプレート編集
│           ├── types.d.ts           # 型定義
│           └── index.css            # Catppuccin Mocha テーマ
├── setups/                  # セットアップガイド
├── examples/                # 設定ファイルの参考例
├── mise.toml                # Node.js 22 + pnpm 11
└── package.json
```

### ランタイムディレクトリ

```
~/.claude-tabs/              # 初回起動時に自動生成
├── config.json              # 設定ファイル
└── Dockerfile               # sbx テンプレート用 Dockerfile
```

## 前提ツール

| ツール | 用途 | 必須 |
|--------|------|------|
| sbx | サンドボックス環境 | ○ |
| Docker | sbx テンプレートビルド | テンプレートビルド時 |
| git | Worktree 作成 | Worktree 機能使用時 |
| gh | PR Link からブランチ解決 | PR Link 使用時 |

## 技術スタック

- **Electron** + electron-vite
- **React 19** + TypeScript
- **node-pty** + **xterm.js** (@xterm/xterm, @xterm/addon-fit)
- **Catppuccin Mocha** テーマ
