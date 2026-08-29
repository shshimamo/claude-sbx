export type HookState = 'input' | 'busy'

export interface Session {
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

export class SessionStore {
  private sessions = new Map<string, Session>()

  createSession(id: string, sbx: string, repoPath: string, shell?: string): Session {
    const session: Session = {
      id,
      sbx,
      repoPath,
      shell,
      name: repoPath.split('/').pop() || repoPath,
      status: 'active',
      hookState: 'input',
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

  updateHookState(id: string, hookState: HookState) {
    const session = this.sessions.get(id)
    if (session) {
      session.hookState = hookState
      session.lastUpdated = Date.now()
    }
  }

  rename(id: string, name: string) {
    const session = this.sessions.get(id)
    if (session) {
      session.name = name
      session.lastUpdated = Date.now()
    }
  }

  remove(id: string) {
    this.sessions.delete(id)
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }
}
