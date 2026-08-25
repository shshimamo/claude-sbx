import { app, BrowserWindow, ipcMain, Menu, Notification } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { SessionStore } from './session-store'
import { SbxManager } from './sbx-manager'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(\x07|\x1b\\)/g

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

function checkNotifications(id: string, data: string): void {
  const patterns = sbxManager.getNotifications()
  if (patterns.length === 0) return

  const text = stripAnsi(data)
  const session = sessionStore.get(id)
  for (const { pattern, title } of patterns) {
    if (text.includes(pattern)) {
      new Notification({
        title,
        body: session?.name || id,
      }).show()
      break
    }
  }
}

let mainWindow: BrowserWindow | null = null
const sessionStore = new SessionStore()
const ptyManager = new PtyManager()
const sbxManager = new SbxManager()
// pty 出力バッファ（レンダラー準備完了前のデータを保持）
const ptyBuffers = new Map<string, string[]>()
const ptyReady = new Set<string>()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e2e',
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIPC() {
  // pty 作成: sbx exec → claude 起動
  ipcMain.handle('pty:create', async (_event, opts: { sbx: string; repoPath: string; shell?: string }) => {
    const id = ptyManager.create(opts.sbx, opts.repoPath, opts.shell)
    const session = sessionStore.createSession(id, opts.sbx, opts.repoPath, opts.shell)

    // pty 出力をバッファ or レンダラーに転送
    ptyBuffers.set(id, [])
    ptyManager.onData(id, (data) => {
      checkNotifications(id, data)
      if (ptyReady.has(id)) {
        mainWindow?.webContents.send('pty:data', id, data)
      } else {
        ptyBuffers.get(id)?.push(data)
      }
    })

    ptyManager.onExit(id, () => {
      sessionStore.updateStatus(id, 'terminated')
      mainWindow?.webContents.send('sessions:updated', sessionStore.getAll())
      mainWindow?.webContents.send('pty:exit', id)
    })

    return session
  })

  // レンダラーが準備完了を通知 → バッファを再生
  ipcMain.on('pty:ready', (_event, id: string) => {
    const buf = ptyBuffers.get(id)
    ptyReady.add(id)
    if (buf) {
      for (const data of buf) {
        mainWindow?.webContents.send('pty:data', id, data)
      }
      ptyBuffers.delete(id)
    }
  })

  // pty にデータ送信（キー入力）
  ipcMain.on('pty:write', (_event, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  // pty リサイズ
  ipcMain.on('pty:resize', (_event, id: string, cols: number, rows: number) => {
    ptyManager.resize(id, cols, rows)
  })

  // pty 破棄
  ipcMain.handle('pty:kill', async (_event, id: string) => {
    sessionStore.remove(id)
    ptyManager.kill(id)
  })

  // セッション一覧取得
  ipcMain.handle('sessions:list', async () => {
    return sessionStore.getAll()
  })

  // セッション名変更
  ipcMain.handle('sessions:rename', async (_event, id: string, name: string) => {
    sessionStore.rename(id, name)
    mainWindow?.webContents.send('sessions:updated', sessionStore.getAll())
  })

  // sbx 一覧取得
  ipcMain.handle('sbx:list', async () => {
    return sbxManager.list()
  })

  // sbx 内のリポジトリ一覧取得
  ipcMain.handle('sbx:repos', async (_event, sbxName: string, noCache?: boolean) => {
    return sbxManager.listRepos(sbxName, noCache)
  })

  // sbx 作成
  ipcMain.handle('sbx:create', async (_event, name: string) => {
    return sbxManager.create(name)
  })

  // sbx 削除
  ipcMain.handle('sbx:delete', async (_event, name: string) => {
    return sbxManager.delete(name)
  })

  // Dockerfile 取得
  ipcMain.handle('sbx:dockerfile:get', async () => {
    return sbxManager.getDockerfile()
  })

  // Dockerfile 保存
  ipcMain.handle('sbx:dockerfile:save', async (_event, content: string) => {
    sbxManager.saveDockerfile(content)
  })

  // テンプレートビルド
  ipcMain.handle('sbx:dockerfile:build', async () => {
    return new Promise<{ ok: boolean; message: string }>((resolve) => {
      sbxManager.buildTemplate(resolve)
    })
  })

  // config.json 取得
  ipcMain.handle('config:get', async () => {
    return sbxManager.getConfig()
  })

  // config.json 保存
  ipcMain.handle('config:save', async (_event, content: string) => {
    sbxManager.saveConfig(content)
  })

  // プレビュー用 config
  ipcMain.handle('sbx:config', async () => {
    return sbxManager.getPreviewConfig()
  })

  // ブランチ一覧
  ipcMain.handle('sbx:branches', async (_event, sbxName: string, repoPath: string) => {
    return sbxManager.listBranches(sbxName, repoPath)
  })

  // worktree 作成
  ipcMain.handle('sbx:worktree:create', async (_event, repo: string, branch: string, baseBranch?: string) => {
    return sbxManager.createWorktree(repo, branch, baseBranch)
  })
}

// macOS GUI アプリはシェルの PATH を継承しないため補完
function fixPath() {
  const extra = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin']
  const current = process.env.PATH || ''
  const missing = extra.filter((p) => !current.split(':').includes(p))
  if (missing.length) {
    process.env.PATH = [...missing, current].join(':')
  }
}

app.whenReady().then(() => {
  fixPath()

  // アプリケーションメニュー
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  setupIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ptyManager.killAll()
  if (process.platform !== 'darwin') app.quit()
})
