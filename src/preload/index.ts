import { contextBridge, ipcRenderer, clipboard } from 'electron'

const api = {
  // pty
  createPty: (opts: { sbx: string; repoPath: string }) => ipcRenderer.invoke('pty:create', opts),
  writePty: (id: string, data: string) => ipcRenderer.send('pty:write', id, data),
  resizePty: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', id, cols, rows),
  killPty: (id: string) => ipcRenderer.invoke('pty:kill', id),
  ptyReady: (id: string) => ipcRenderer.send('pty:ready', id),

  onPtyData: (cb: (id: string, data: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string, data: string) => cb(id, data)
    ipcRenderer.on('pty:data', listener)
    return () => ipcRenderer.removeListener('pty:data', listener)
  },
  onPtyExit: (cb: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => cb(id)
    ipcRenderer.on('pty:exit', listener)
    return () => ipcRenderer.removeListener('pty:exit', listener)
  },

  // sessions
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  onSessionsUpdated: (cb: (sessions: unknown[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessions: unknown[]) => cb(sessions)
    ipcRenderer.on('sessions:updated', listener)
    return () => ipcRenderer.removeListener('sessions:updated', listener)
  },

  renameSession: (id: string, name: string) => ipcRenderer.invoke('sessions:rename', id, name),

  // sbx
  listSbx: () => ipcRenderer.invoke('sbx:list'),
  listRepos: (sbxName: string, noCache?: boolean) => ipcRenderer.invoke('sbx:repos', sbxName, noCache),
  createSbx: (name: string) => ipcRenderer.invoke('sbx:create', name),
  deleteSbx: (name: string) => ipcRenderer.invoke('sbx:delete', name),

  // dockerfile
  getDockerfile: () => ipcRenderer.invoke('sbx:dockerfile:get'),
  saveDockerfile: (content: string) => ipcRenderer.invoke('sbx:dockerfile:save', content),
  buildTemplate: () => ipcRenderer.invoke('sbx:dockerfile:build'),

  // branches & worktree
  listBranches: (sbxName: string, repoPath: string) =>
    ipcRenderer.invoke('sbx:branches', sbxName, repoPath),
  createWorktree: (repo: string, branch: string, baseBranch?: string) =>
    ipcRenderer.invoke('sbx:worktree:create', repo, branch, baseBranch),

  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (content: string) => ipcRenderer.invoke('config:save', content),
  getSbxConfig: () => ipcRenderer.invoke('sbx:config'),

  // clipboard
  clipboardWrite: (text: string) => clipboard.writeText(text),
}

contextBridge.exposeInMainWorld('api', api)
