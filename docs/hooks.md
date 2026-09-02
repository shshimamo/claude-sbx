# Hook イベントフロー

## 概要

Claude Code の hook 機能を利用して、タスク完了や質問などのイベントを検知し、OS 通知とサイドバーのステータス表示を実現する。

## イベントフロー

```
[sbx 内 Claude Code]     [sbx 内 hooks]         [ホスト fs]           [Main: HookWatcher]    [Renderer]
  │                          │                      │                      │                      │
  │ Stop/PermissionRequest/  │                      │                      │                      │
  │ AskUserQuestion 発火 ───►│                      │                      │                      │
  │                          ├─ notify.sh ─────────►│ notifications/*.json │                      │
  │                          ├─ state.sh ──────────►│ states/*.json        │                      │
  │                          │                      │                      │                      │
  │                          │                      │  fs.watch 検知 ─────►│                      │
  │                          │                      │                      │                      │
  │                          │                      │  notifyWatcher:      │                      │
  │                          │                      │   └─ config の events│                      │
  │                          │                      │      にあれば        │                      │
  │                          │                      │      Notification ───┼──► OS 通知           │
  │                          │                      │                      │                      │
  │                          │                      │  stateWatcher:       │                      │
  │                          │                      │   └─ INPUT_EVENTS?   │                      │
  │                          │                      │      ├─ Yes: 'input' │                      │
  │                          │                      │      └─ No:  'busy'  │                      │
  │                          │                      │   SessionStore       │                      │
  │                          │                      │    .updateHookState()│                      │
  │                          │                      │                      │                      │
  │                          │                      │   send('sessions:updated') ────────────────►│
  │                          │                      │                      │    Sidebar 再描画     │
  │                          │                      │                      │    ドット色+ラベル更新│
```

## 2つの shell スクリプト

| スクリプト | 書き込み先 | 用途 | 有効条件 |
|-----------|-----------|------|---------|
| `notify.sh` | `~/.claude-sbx/notifications/` | OS 通知 | `hook_notifications.events` に含まれるイベントのみ |
| `state.sh` | `~/.claude-sbx/states/` | ステータス表示 | 常に有効（`CLAUDE_SBX_ID` がある場合のみ書き込み） |

## 対応イベントと hook 設定

| Claude Code hook | matcher | notify.sh | state.sh |
|-----------------|---------|-----------|----------|
| Stop | （なし） | o | o |
| PermissionRequest | （なし） | o | o |
| PreToolUse | AskUserQuestion | o | o |
| UserPromptSubmit | （なし） | | o |
| PostToolUse | （なし） | | o |

## 状態遷移

```
              Stop, PermissionRequest, AskUserQuestion
                ┌──────────────────────┐
                │                      ▼
             ┌──────┐            ┌───────────┐
  初期 ────► │input │            │   input   │ (入力待ち: 青ドット)
             └──────┘            └───────────┘
                ▲                      │
                │                      │ UserPromptSubmit, PostToolUse
                │                      ▼
                │                ┌───────────┐
                └────────────────│   busy    │ (処理待ち: 黄ドット)
                                 └───────────┘
```

- **input**（入力待ち）: ユーザーの操作が必要な状態。青ドット
- **busy**（処理待ち）: Claude が処理中。黄ドット

## JSON ファイル形式

notify.sh / state.sh が書き込む JSON:

```json
{
  "event": "Stop",
  "claude_sbx_id": "session-1234567890-1",
  "data": { "session_id": "...", "cwd": "/path/to/repo" }
}
```

- `claude_sbx_id`: PTY 作成時に環境変数 `CLAUDE_SBX_ID` として設定されるセッション ID
- ファイル名: `<timestamp>-<PID>.json`（一意性の確保）
- HookWatcher は最新ファイルのみ残し、古いファイルを自動削除

## HookWatcher の動作

1. `fs.watch` でディレクトリを監視
2. `.json` ファイルの変更を検知
3. 50ms 遅延後に処理（ファイル書き込み完了を待つ）
4. 古いファイルを削除（最新のみ残す）
5. JSON をパースしてコールバックを呼び出し

## セットアップ

`setup_hooks.sh` が sbx 内で以下を行う:

1. `~/.claude-sbx/bin/notify.sh` と `state.sh` を生成
2. `~/.claude/settings.json` に hook 設定をマージ（既存設定を保持）

詳細は `examples/post_create_cmds/setup_hooks.sh` を参照。
