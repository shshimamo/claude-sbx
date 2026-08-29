type HookState = 'input' | 'busy'

interface Session {
  id: string
  sbx: string
  repoPath: string
  shell?: string
  name: string
  status: 'active' | 'terminated'
  hookState: HookState
  createdAt: number
  lastUpdated: number
}

interface Api {
  createPty: (opts: { sbx: string; repoPath: string; shell?: string }) => Promise<Session>
  writePty: (id: string, data: string) => void
  resizePty: (id: string, cols: number, rows: number) => void
  killPty: (id: string) => Promise<void>
  ptyReady: (id: string) => void
  onPtyData: (cb: (id: string, data: string) => void) => () => void
  onPtyExit: (cb: (id: string) => void) => () => void
  renameSession: (id: string, name: string) => Promise<void>
  listSessions: () => Promise<Session[]>
  onSessionsUpdated: (cb: (sessions: Session[]) => void) => () => void
  listSbx: () => Promise<string[]>
  listRepos: (sbxName: string, noCache?: boolean) => Promise<{ path: string; branch: string }[]>
  createSbx: (name: string) => Promise<{ ok: boolean; message: string }>
  deleteSbx: (name: string) => Promise<{ ok: boolean; message: string }>
  getDockerfile: () => Promise<string>
  saveDockerfile: (content: string) => Promise<void>
  buildTemplate: () => Promise<{ ok: boolean; message: string }>
  listBranches: (sbxName: string, repoPath: string) => Promise<string[]>
  createWorktree: (repo: string, branch: string, baseBranch?: string) => Promise<{ ok: boolean; wtPath: string; message: string }>
  getConfig: () => Promise<string>
  saveConfig: (content: string) => Promise<void>
  getSbxConfig: () => Promise<SbxPreviewConfig>
  clipboardWrite: (text: string) => void
}

interface SbxPreviewConfig {
  template: string
  cloneBase: string
  worktreeBase: string
  mounts: string[]
  kits: string[]
  postCreateCmds: string[][]
  plugins: { source: string; plugins: string[] }[]
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
