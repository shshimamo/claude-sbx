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
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
