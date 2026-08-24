interface Session {
  id: string
  sbx: string
  repoPath: string
  status: 'active' | 'ai_working' | 'waiting_input' | 'permission_required' | 'idle' | 'terminated'
  createdAt: number
  lastUpdated: number
  claudeSessionId?: string
  lastOutput?: string
  question?: string
}

interface Api {
  createPty: (opts: { sbx: string; repoPath: string }) => Promise<Session>
  writePty: (id: string, data: string) => void
  resizePty: (id: string, cols: number, rows: number) => void
  killPty: (id: string) => Promise<void>
  ptyReady: (id: string) => void
  onPtyData: (cb: (id: string, data: string) => void) => () => void
  onPtyExit: (cb: (id: string) => void) => () => void
  listSessions: () => Promise<Session[]>
  onSessionsUpdated: (cb: (sessions: Session[]) => void) => () => void
  listSbx: () => Promise<string[]>
  listRepos: (sbxName: string) => Promise<{ path: string; branch: string }[]>
  createSbx: (name: string) => Promise<{ ok: boolean; message: string }>
  deleteSbx: (name: string) => Promise<{ ok: boolean; message: string }>
  getDockerfile: () => Promise<string>
  saveDockerfile: (content: string) => Promise<void>
  buildTemplate: () => Promise<{ ok: boolean; message: string }>
  listBranches: (sbxName: string, repoPath: string) => Promise<string[]>
  createWorktree: (repo: string, branch: string, baseBranch?: string) => Promise<{ ok: boolean; wtPath: string; message: string }>
  getSbxConfig: () => Promise<SbxPreviewConfig>
}

interface SbxPreviewConfig {
  template: string
  cloneBase: string
  claudeTabsDir: string
  worktreeBase: string
  mounts: string[]
  kits: string[]
  postCreateCmds: string[][]
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
