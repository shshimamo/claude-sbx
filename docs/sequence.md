# シーケンス図

## 1. アプリ起動

```
app.whenReady()
  │
  ├─ fixPath()                    # macOS GUI 用に PATH 補完
  ├─ Menu.setApplicationMenu()    # メニューバー設定
  ├─ setupIPC()                   # IPC ハンドラ登録（後述）
  ├─ createWindow()               # BrowserWindow 作成 → preload → renderer ロード
  │
  ├─ notifyWatcher.start()        # ~/.claude-sbx/notifications/ を fs.watch
  └─ stateWatcher.start()         # ~/.claude-sbx/states/ を fs.watch
```

SbxManager のコンストラクタで `ensureDefaults()` が呼ばれ、`~/.claude-sbx/config.json` と `Dockerfile` が未存在なら自動生成。

## 2. セッション作成

```
[Renderer]                    [Preload]                [Main]
  │                              │                        │
  │ NewSessionModal              │                        │
  │  └─ onCreate(sbx, repo, sh) │                        │
  │      └─ api.createPty()  ───┼─ invoke('pty:create') ─┤
  │                              │                        ├─ PtyManager.create()
  │                              │                        │    ├─ pty.spawn(loginShell)   # ホスト側シェル起動
  │                              │                        │    └─ proc.write(sbx exec ...) # sbx 内で claude 起動
  │                              │                        │       └─ export CLAUDE_SBX_ID=<id> && cd <repo> && claude
  │                              │                        │
  │                              │                        ├─ SessionStore.createSession()
  │                              │                        │    └─ hookState: 'input'
  │                              │                        │
  │                              │                        ├─ ptyManager.onData() 登録
  │                              │                        │    └─ バッファ or send('pty:data')
  │                              │                        │
  │                              │                        └─ ptyManager.onExit() 登録
  │                              │                             └─ status → 'terminated'
  │                              │                        │
  │◄─────── session 返却 ────────┤◄───────────────────────┤
  │                              │                        │
  │ App: setSessions(), setActiveId()                     │
  │  └─ <Terminal sessionId active>                       │
  │      └─ xterm.open()                                  │
  │          └─ requestAnimationFrame → fitAddon.fit()    │
```

## 3. ターミナルデータフロー

```
[sbx 内 claude]          [Main: node-pty]         [Renderer: xterm.js]
  │                          │                          │
  │ stdout ─────────────────►│ onData(data)             │
  │                          │  ├─ checkNotifications() │
  │                          │  │   └─ パターンマッチで  │
  │                          │  │     OS 通知           │
  │                          │  │                       │
  │                          │  └─ ptyReady?            │
  │                          │      ├─ Yes: send ───────►│ xterm.write(data)
  │                          │      └─ No: バッファ追加  │
  │                          │                          │
  │                          │  pty:ready ◄─────────────│ (Terminal マウント時)
  │                          │  └─ バッファ一括再生 ───►│
  │                          │                          │
  │◄─────────────────────────│ pty:write ◄──────────────│ xterm.onData (キー入力)
  │                          │                          │
  │                          │ pty:resize ◄─────────────│ xterm.onResize / window resize
  │                          │  └─ proc.resize()        │
```

## 4. フック状態管理

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

### 状態遷移

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

## 5. ファイル構成と役割

### Main Process
| ファイル | 役割 |
|---------|------|
| `index.ts` | エントリポイント。IPC 配線、ウォッチャー起動、ウィンドウ管理 |
| `pty-manager.ts` | node-pty ラッパー。sbx exec コマンド構築、CLAUDE_SBX_ID 設定 |
| `session-store.ts` | セッションの CRUD + hookState 管理（インメモリ） |
| `sbx-manager.ts` | sbx CLI ラッパー。config/Dockerfile/リポジトリ/worktree 管理 |
| `hook-watcher.ts` | ディレクトリ監視。JSON ファイル検知 → コールバック |

### Preload
| ファイル | 役割 |
|---------|------|
| `index.ts` | contextBridge で `window.api` を公開。Main ↔ Renderer の橋渡し |

### Renderer
| ファイル | 役割 |
|---------|------|
| `App.tsx` | ルートコンポーネント。セッション state、モーダル制御 |
| `Terminal.tsx` | xterm.js ラッパー。fit, search, OSC 52, 自動コピー |
| `Sidebar.tsx` | セッション一覧。ステータスドット、hookState ラベル |
| `NewSessionModal.tsx` | 新規セッション作成。Existing repo / New worktree / Shell |
| `ManageSbxModal.tsx` | sbx 管理 |
| `DockerfileModal.tsx` | Dockerfile 編集 |
| `ConfigModal.tsx` | config.json 編集 |
