# config.json

`~/.claude-sbx/config.json` で設定。初回起動時に自動生成される。

## スキーマ

```json
{
  "sbx": {
    "template": "my-template",
    "clone_base": "~/src",
    "worktree_base": "~/worktrees",
    "mounts": ["~/dotfiles"],
    "kits": ["kit-name"],
    "post_create_cmds": [
      ["~/.claude-sbx/setup_hooks.sh"]
    ],
    "plugins": [
      {
        "source": "~/plugins/my-plugin",
        "plugins": ["plugin-name"]
      }
    ]
  },
  "notifications": [
    {
      "pattern": "Task completed",
      "title": "タスク完了"
    }
  ],
  "hook_notifications": {
    "events": ["Stop", "PermissionRequest", "AskUserQuestion"]
  }
}
```

## 設定項目

### sbx

| キー | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `template` | string | なし | sbx テンプレート名。Docker でビルドしたカスタムイメージを使う場合に設定 |
| `clone_base` | string | `~/src` | リポジトリ検索のベースディレクトリ。sbx 作成時にマウントされる |
| `worktree_base` | string | `~/worktrees` | Worktree 保存先。設定時は sbx 作成時にマウントされる |
| `mounts` | string[] | `[]` | sbx 作成時の追加マウントパス。`~` 展開可 |
| `kits` | string[] | `[]` | sbx 作成時に適用する kit |
| `post_create_cmds` | string[][] | `[]` | sbx 作成後に `sbx exec` で実行するコマンド。各コマンドは引数の配列 |
| `plugins` | object[] | `[]` | Claude plugins の自動インストール設定 |

### notifications（pty 出力通知）

pty の出力テキストにパターンがマッチしたら OS 通知を表示する。

| キー | 型 | 説明 |
|------|-----|------|
| `pattern` | string | マッチするテキスト（部分一致） |
| `title` | string | 通知のタイトル |

ANSI エスケープシーケンスは自動で除去されるため、表示テキストでマッチできる。

### hook_notifications（hook イベント通知）

Claude Code の hook イベントで OS 通知を表示する。

| キー | 型 | 説明 |
|------|-----|------|
| `events` | string[] | 通知するイベント名の配列 |

対応イベント:

| イベント | 通知タイトル | タイミング |
|---------|------------|-----------|
| `Stop` | タスク完了 | Claude がタスクを完了して停止した時 |
| `PermissionRequest` | 許可待ち | ツール実行の許可を求めている時 |
| `AskUserQuestion` | 質問あり | Claude がユーザーに質問している時 |

## 自動マウント

sbx 作成時に以下のパスが自動でマウントされる:

1. `clone_base`（デフォルト: `~/src`）
2. `~/.claude-sbx`（常にマウント）
3. `worktree_base`（設定時のみ）
4. `mounts` の各パス

## plugins 設定

```json
{
  "plugins": [
    {
      "source": "~/plugins/my-plugin",
      "plugins": ["plugin-name"]
    }
  ]
}
```

- `source`: プラグインのソースパス or URL。ローカルパスの場合はマウント済みである必要がある（未マウントなら警告）
- `plugins`: インストールするプラグイン名の配列

sbx 作成時に `claude plugins marketplace add <source>` → `claude plugins install <plugin>` が自動実行される。

## デフォルト設定

初回起動時に生成される config.json:

```json
{
  "sbx": {
    "clone_base": "~/src",
    "worktree_base": "~/worktrees"
  }
}
```
