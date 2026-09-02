# Main プロセス処理一覧

## IPC ハンドラ（Renderer からの要求）

| カテゴリ | 処理 | IPC チャネル | UI トリガー | 実行内容 | 実行コマンド |
|---------|------|-------------|-----------|---------|-------------|
| PTY | PTY 作成 | `pty:create` | NewSessionModal「作成」ボタン | pty 起動、セッション作成 | `sbx exec -it <name> sh -c 'cd <path> && <shell>'` |
| PTY | キー入力送信 | `pty:write` | ターミナルへのキー入力 | pty プロセスへデータ書き込み | |
| PTY | リサイズ | `pty:resize` | ウィンドウリサイズ | pty プロセスの cols/rows 変更 | |
| PTY | PTY 破棄 | `pty:kill` | サイドバー「×」ボタン | pty プロセス終了、セッション削除 | |
| PTY | バッファ再生 | `pty:ready` | Terminal コンポーネント初期化完了 | バッファ済みデータを一括送信 | |
| セッション | 一覧取得 | `sessions:list` | App 初期化時 | インメモリのセッション一覧を返却 | |
| セッション | 名前変更 | `sessions:rename` | サイドバーでセッション名ダブルクリック | セッション名更新 → レンダラーに通知 | |
| sbx 管理 | sbx 一覧 | `sbx:list` | ManageSbxModal / NewSessionModal 表示時 | sbx 一覧取得 | `sbx ls -q` |
| sbx 管理 | sbx create プレビュー | `sbx:config` | NewSessionModal / ManageSbxModal / DockerfileModal 表示時 | sbx create プレビュー情報を返却 | |
| sbx 管理 | sbx 作成 | `sbx:create` | ManageSbxModal「作成」ボタン | sbx 作成 + 初期設定 | `sbx create --name <name> [-t <template>] [--kit <kit>] claude <paths...>` |
| sbx 管理 | sbx 作成（後処理） | `sbx:create` | （同上） | post_create_cmds 実行 | `sbx exec <name> <cmd...>` |
| sbx 管理 | sbx 作成（プラグイン） | `sbx:create` | （同上） | プラグインインストール | `sbx exec <name> claude plugins marketplace add <source>`, `sbx exec <name> claude plugins install <plugin>` |
| sbx 管理 | sbx 削除 | `sbx:delete` | ManageSbxModal「削除」ボタン | sbx 削除 | `sbx rm -f <name>` |
| リポジトリ | リポジトリ一覧 | `sbx:repos` | NewSessionModal で sbx 選択時 | `.git` 検索、キャッシュ対応 | `sbx exec <name> find <base> -name .git -type d -maxdepth 4` |
| リポジトリ | ブランチ一覧 | `sbx:branches` | NewSessionModal で Worktree リポジトリ選択時 | リモートブランチ一覧 | `sbx exec <name> git -C <repo> branch -r --format=%(refname:short)` |
| リポジトリ | Worktree 作成 | `sbx:worktree:create` | NewSessionModal「Worktree 作成」ボタン | ホスト側で worktree 作成 | `git -C <repo> fetch origin`, `git -C <repo> worktree add <path> [<branch>]` |
| リポジトリ | PR URL 解決 | `sbx:worktree:create` | （同上） | PR URL → ブランチ名 | `gh pr view <url> --json headRefName -q .headRefName` |
| Dockerfile | 取得 | `sbx:dockerfile:get` | DockerfileModal 表示時 | ファイル読み込み | |
| Dockerfile | 保存 | `sbx:dockerfile:save` | DockerfileModal「保存」ボタン | ファイル書き込み | |
| Dockerfile | テンプレートビルド | `sbx:dockerfile:build` | DockerfileModal「ビルド」ボタン | Docker イメージビルド → sbx 登録 | `docker build -t <tag> -f <dockerfile> <dir>`, `docker save <tag> -o <tmp>`, `sbx template load <tmp>` |
| Config | 取得 | `config:get` | ConfigModal 表示時 | ファイル読み込み | |
| Config | 保存 | `config:save` | ConfigModal「保存」ボタン | ファイル書き込み | |

## 内部処理（IPC 以外）

| カテゴリ | 処理 | トリガー | 実行内容 |
|---------|------|----------|---------|
| 起動 | PATH 補完 | アプリ起動時 | `/opt/homebrew/bin` 等を PATH に追加（macOS GUI 用） |
| 起動 | デフォルトファイル生成 | アプリ起動時 | `~/.claude-sbx/config.json`, `Dockerfile` が未存在なら自動生成 |
| 起動 | メニュー設定 | アプリ起動時 | macOS アプリメニュー構築 |
| 監視 | OS 通知 | `notifications/*.json` 変更 | config の events に含まれるイベントなら OS 通知表示 |
| 監視 | 状態更新 | `states/*.json` 変更 | input/busy 判定 → SessionStore 更新 → レンダラー通知 |
| 監視 | pty 出力通知 | pty stdout | config の notifications パターンにマッチしたら OS 通知 |
| PTY | バッファリング | pty stdout | レンダラー未準備ならバッファ、`pty:ready` 後に再生 |
| PTY | 終了検知 | pty exit | セッション status を `terminated` に更新 → レンダラー通知 |

## 外部コマンド実行一覧

| コマンド | 実行箇所 | 用途 |
|---------|---------|------|
| `sbx ls -q` | sbx-manager | sbx 一覧取得 |
| `sbx create --name <name> ...` | sbx-manager | sbx 作成（template, kits, mounts 指定） |
| `sbx rm -f <name>` | sbx-manager | sbx 削除 |
| `sbx exec <name> find ...` | sbx-manager | リポジトリ検索 |
| `sbx exec <name> git ...` | sbx-manager | ブランチ一覧、プラグインインストール |
| `sbx exec -it <name> <shell>` | pty-manager | ターミナル起動 |
| `git -C <repo> fetch/worktree add` | sbx-manager | Worktree 作成（ホスト側実行） |
| `gh pr view ...` | sbx-manager | PR URL → ブランチ名解決 |
| `docker build / save` | sbx-manager | テンプレートビルド |
| `sbx template load` | sbx-manager | テンプレート登録 |
