export interface Session {
  id: string
  sbx: string
  repoPath: string
  shell?: string
  status: 'active' | 'terminated'
  createdAt: number
  lastUpdated: number
}

export class SessionStore {
  private sessions = new Map<string, Session>()

  createSession(id: string, sbx: string, repoPath: string, shell?: string): Session {
    const session: Session = {
      id,
      sbx,
      repoPath,
      shell,
      status: 'active',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    }
    this.sessions.set(id, session)
    return session
  }

  updateStatus(id: string, status: Session['status']) {
    const session = this.sessions.get(id)
    if (session) {
      session.status = status
      session.lastUpdated = Date.now()
    }
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }
}
