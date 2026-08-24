export interface Session {
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

export class SessionStore {
  private sessions = new Map<string, Session>()

  createSession(id: string, sbx: string, repoPath: string): Session {
    const session: Session = {
      id,
      sbx,
      repoPath,
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

  // hook から呼ばれる: claudeSessionId でマッチ or sbx+repo でマッチ
  updateFromHook(data: {
    session_id: string
    status: string
    question?: string
    last_output?: string
  }) {
    // claudeSessionId で検索
    for (const session of this.sessions.values()) {
      if (session.claudeSessionId === data.session_id) {
        session.status = this.mapHookStatus(data.status)
        session.lastUpdated = Date.now()
        session.question = data.question
        session.lastOutput = data.last_output
        return session
      }
    }

    // claudeSessionId が未設定のアクティブセッションに紐づけ
    for (const session of this.sessions.values()) {
      if (!session.claudeSessionId && session.status === 'active') {
        session.claudeSessionId = data.session_id
        session.status = this.mapHookStatus(data.status)
        session.lastUpdated = Date.now()
        session.question = data.question
        session.lastOutput = data.last_output
        return session
      }
    }

    return null
  }

  private mapHookStatus(hookStatus: string): Session['status'] {
    const map: Record<string, Session['status']> = {
      ai_working: 'ai_working',
      waiting_input: 'waiting_input',
      permission_required: 'permission_required',
      idle: 'idle',
      terminated: 'terminated',
    }
    return map[hookStatus] || 'active'
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }
}
