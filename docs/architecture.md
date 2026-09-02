# アーキテクチャ

## プロセス構成

Electron は1つのアプリ内に2つのプロセスが動く:

```
┌─────────────────────────────────────────────────────────┐
│                    Electron アプリ                        │
│                                                          │
│  ┌────────────────────┐       ┌───────────────────────┐ │
│  │   Main Process     │       │  Renderer Process     │ │
│  │   (Node.js)        │       │  (Chromium/ブラウザ)   │ │
│  │                    │       │                       │ │
│  │  できること:        │       │  できること:           │ │
│  │  ・ファイル読み書き │  IPC  │  ・HTML/CSS 描画      │ │
│  │  ・コマンド実行     │◄─────►│  ・React コンポーネント│ │
│  │  ・OS 通知          │       │  ・ユーザー操作受付   │ │
│  │  ・pty (ターミナル) │       │  ・xterm.js 表示      │ │
│  │                    │       │                       │ │
│  │  できないこと:      │       │  できないこと:        │ │
│  │  ・UI 描画          │       │  ・ファイル操作       │ │
│  │                    │       │  ・コマンド実行       │ │
│  └────────────────────┘       └───────────────────────┘ │
│            ▲                            ▲               │
│            │         Preload            │               │
│            │   ┌──────────────────┐     │               │
│            └───│ contextBridge    │─────┘               │
│                │ window.api を公開│                      │
│                └──────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

## IPC（プロセス間通信）

Renderer から Main の機能を呼ぶには IPC を経由する。2パターンある:

| パターン | 用途 | 例 |
|---------|------|-----|
| `ipcMain.handle` + `ipcRenderer.invoke` | 戻り値あり（リクエスト/レスポンス） | `pty:create`, `sbx:list` |
| `ipcMain.on` + `ipcRenderer.send` | 戻り値なし（一方向通知） | `pty:write`, `pty:resize` |
| `mainWindow.webContents.send` + `ipcRenderer.on` | Main → Renderer への push | `pty:data`, `sessions:updated` |

### 例: セッション作成

```
Renderer                    Preload                   Main
   │                           │                        │
   │ window.api.createPty() ──►│                        │
   │                           │ ipcRenderer.invoke ───►│
   │                           │   ('pty:create', opts) │
   │                           │                        ├─ PtyManager.create()
   │                           │                        ├─ SessionStore.createSession()
   │                           │◄── session を返却 ─────┤
   │◄── Promise 解決 ──────────│                        │
   │                           │                        │
   │                           │   (その後、Main から)   │
   │                           │◄── send('pty:data') ──┤ pty 出力があるたびに push
   │◄── onPtyData コールバック─│                        │
```

## なぜ直接呼べない？

セキュリティのため。Renderer はブラウザと同じ環境なので、もし悪意あるコードが混入しても `fs.readFile` や `child_process.exec` を直接呼べない。Preload の `contextBridge` で**許可した API だけ**を `window.api` として公開してる。

## IPC チャネル一覧

| チャネル | 方式 | 方向 | 用途 |
|---------|------|------|------|
| `pty:create` | invoke/handle | R→M | PTY 作成 |
| `pty:write` | send/on | R→M | キー入力送信 |
| `pty:resize` | send/on | R→M | ターミナルリサイズ |
| `pty:kill` | invoke/handle | R→M | PTY 破棄 |
| `pty:ready` | send/on | R→M | バッファ再生要求 |
| `pty:data` | send/on | M→R | PTY 出力 |
| `pty:exit` | send/on | M→R | PTY 終了 |
| `sessions:list` | invoke/handle | R→M | セッション一覧 |
| `sessions:rename` | invoke/handle | R→M | セッション名変更 |
| `sessions:updated` | send/on | M→R | セッション更新通知 |
| `sbx:list` | invoke/handle | R→M | sbx 一覧 |
| `sbx:repos` | invoke/handle | R→M | リポジトリ一覧 |
| `sbx:create` | invoke/handle | R→M | sbx 作成 |
| `sbx:delete` | invoke/handle | R→M | sbx 削除 |
| `sbx:branches` | invoke/handle | R→M | ブランチ一覧 |
| `sbx:worktree:create` | invoke/handle | R→M | Worktree 作成 |
| `sbx:dockerfile:get` | invoke/handle | R→M | Dockerfile 取得 |
| `sbx:dockerfile:save` | invoke/handle | R→M | Dockerfile 保存 |
| `sbx:dockerfile:build` | invoke/handle | R→M | テンプレートビルド |
| `config:get` | invoke/handle | R→M | config.json 取得 |
| `config:save` | invoke/handle | R→M | config.json 保存 |
| `sbx:config` | invoke/handle | R→M | sbx create プレビュー |

R=Renderer, M=Main

## ファイル対応表

| プロセス | ファイル | 役割 |
|---------|---------|------|
| Main | `src/main/index.ts` | エントリポイント。IPC ハンドラ登録、ウィンドウ管理 |
| Main | `src/main/pty-manager.ts` | node-pty で sbx 内のターミナルを管理 |
| Main | `src/main/session-store.ts` | セッション状態のインメモリ管理 |
| Main | `src/main/sbx-manager.ts` | sbx CLI / config / Dockerfile 管理 |
| Main | `src/main/hook-watcher.ts` | ディレクトリ監視（通知・状態更新） |
| Preload | `src/preload/index.ts` | `window.api` の定義。IPC の橋渡し |
| Renderer | `src/renderer/src/App.tsx` | React ルート。セッション管理、モーダル制御 |
| Renderer | `src/renderer/src/Terminal.tsx` | xterm.js ターミナル |
| Renderer | `src/renderer/src/Sidebar.tsx` | サイドバー。ステータス表示 |
| Renderer | `src/renderer/src/NewSessionModal.tsx` | 新規セッション作成 |
| Renderer | `src/renderer/src/ManageSbxModal.tsx` | sbx 管理 |
| Renderer | `src/renderer/src/DockerfileModal.tsx` | Dockerfile 編集 |
| Renderer | `src/renderer/src/ConfigModal.tsx` | config.json 編集 |
