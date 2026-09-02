# セキュリティ

## コマンド実行の安全性

### execFileSync（shell 経由しない）

外部コマンドの実行にはすべて `execFileSync` を使用。`execSync` や `exec` と違い、shell を経由せず直接プロセスを起動するため、シェルインジェクションのリスクがない。

```typescript
// NG: shell 経由 → インジェクション可能
execSync(`sbx exec ${name} find ${base} ...`)

// OK: 引数が配列 → shell を経由しない
execFileSync('sbx', ['exec', name, 'find', base, ...])
```

### shellEscape（PTY 経由のコマンド）

PTY 経由で sbx 内にコマンドを送る場合は `proc.write()` でテキストとして書き込むため、`execFileSync` が使えない。この場合は `shellEscape()` でシングルクォートエスケープを行う。

```typescript
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

// 使用例
const cmd = `sbx exec -it ${shellEscape(sbx)} sh -c ${shellEscape(innerCmd)}`
proc.write(cmd + '\r')
```

### shell ホワイトリスト

PTY 作成時に実行するコマンドはホワイトリストで制限:

```typescript
const ALLOWED_SHELLS = ['claude', 'bash', 'zsh']
const execCmd = shell && ALLOWED_SHELLS.includes(shell) ? shell : 'claude'
```

ホワイトリスト外の値が渡された場合は `claude` にフォールバック。

## sandbox 設計

### sbx によるプロセス隔離

Claude Code は sbx（Docker ベースのサンドボックス）内で実行される。ホスト側のファイルシステムへのアクセスは config.json で指定されたマウントパスに限定される。

### Electron の contextIsolation

Renderer プロセスから Node.js API に直接アクセスできない設計:

```typescript
webPreferences: {
  contextIsolation: true,   // Renderer と Node.js のコンテキストを分離
  nodeIntegration: false,   // Renderer で require/import を禁止
  sandbox: false,           // ipcRenderer.on (Main→Renderer push) に必要
}
```

`sandbox: false` は Electron のデフォルト sandbox を無効にするが、`contextIsolation: true` により Renderer から Node.js API へのアクセスは遮断されている。Preload の `contextBridge` で許可した API（`window.api`）のみ公開。

## 入力値の検証

### config.json

- ファイル読み書きのパスは `~/.claude-sbx/` 固定（ユーザー入力でパスを変更できない）
- `post_create_cmds` はユーザーが config.json に記述したコマンドをそのまま実行する設計。config.json 自体がユーザーの管理下にあるため、信頼境界内として扱う

### HookWatcher

- 監視対象は `~/.claude-sbx/notifications/` と `~/.claude-sbx/states/` の固定ディレクトリ
- `.json` 拡張子のファイルのみ処理
- JSON パースに失敗したファイルは無視

## タイムアウト

すべての外部コマンドにタイムアウトを設定:

| コマンド | タイムアウト |
|---------|------------|
| `sbx ls -q` | 5秒 |
| `sbx create` | 300秒（5分） |
| `sbx rm` | 15秒 |
| `sbx exec find` | 10秒 |
| `sbx exec git` | 5〜10秒 |
| `post_create_cmds` | 30秒 |
| `docker build` | 300秒 |
| `docker save` | 120秒 |
| `sbx template load` | 120秒 |
| `gh pr view` | 15秒 |
