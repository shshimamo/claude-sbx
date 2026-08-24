import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty-manager'
import { HookServer } from './hook-server'
import { SessionStore } from './session-store'

let mainWindow: BrowserWindow | null = null
const sessionStore = new SessionStore()
const ptyManager = new PtyManager()
let hookServer: HookServer | null = null
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
  ipcMain.handle('pty:create', async (_event, opts: { sbx: string; repoPath: string }) => {
    const id = ptyManager.create(opts.sbx, opts.repoPath)
    const session = sessionStore.createSession(id, opts.sbx, opts.repoPath)

    // pty 出力をバッファ or レンダラーに転送
    ptyBuffers.set(id, [])
    ptyManager.onData(id, (data) => {
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
    ptyManager.kill(id)
  })

  // セッション一覧取得
  ipcMain.handle('sessions:list', async () => {
    return sessionStore.getAll()
  })

  // sbx 一覧取得
  ipcMain.handle('sbx:list', async () => {
    return ptyManager.listSbx()
  })

  // sbx 内のリポジトリ一覧取得
  ipcMain.handle('sbx:repos', async (_event, sbxName: string) => {
    return ptyManager.listRepos(sbxName)
  })
}

app.whenReady().then(() => {
  setupIPC()
  createWindow()

  hookServer = new HookServer(6277, sessionStore, () => {
    mainWindow?.webContents.send('sessions:updated', sessionStore.getAll())
  })
  hookServer.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ptyManager.killAll()
  hookServer?.stop()
  if (process.platform !== 'darwin') app.quit()
})
