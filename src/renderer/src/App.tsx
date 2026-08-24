import { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar'
import Terminal from './Terminal'
import NewSessionModal from './NewSessionModal'
import ManageSbxModal from './ManageSbxModal'
import DockerfileModal from './DockerfileModal'
import ConfigModal from './ConfigModal'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showManageSbx, setShowManageSbx] = useState(false)
  const [showDockerfile, setShowDockerfile] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    window.api.listSessions().then(setSessions)
    const unsub = window.api.onSessionsUpdated(setSessions)
    return unsub
  }, [])

  const handleCreate = useCallback(async (sbx: string, repoPath: string) => {
    const session = await window.api.createPty({ sbx, repoPath })
    setSessions((prev) => {
      if (prev.some((s) => s.id === session.id)) return prev
      return [...prev, session]
    })
    setActiveId(session.id)
    setShowNewSession(false)
  }, [])

  const handleClose = useCallback(async (id: string) => {
    await window.api.killPty(id)
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      if (activeId === id) {
        setActiveId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
      }
      return remaining
    })
  }, [activeId])

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={handleClose}
        onNewSession={() => setShowNewSession(true)}
        onManageSbx={() => setShowManageSbx(true)}
        onDockerfile={() => setShowDockerfile(true)}
        onConfig={() => setShowConfig(true)}
      />
      <main className="main-content">
        {sessions.map((s) => (
          <div key={s.id} className={`terminal-pane ${s.id === activeId ? 'active' : ''}`}>
            <Terminal sessionId={s.id} active={s.id === activeId} />
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="empty-state" onClick={() => setShowNewSession(true)}>
            + 新規セッション作成
          </div>
        )}
      </main>
      {showNewSession && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onCreate={handleCreate}
        />
      )}
      {showManageSbx && (
        <ManageSbxModal onClose={() => setShowManageSbx(false)} />
      )}
      {showDockerfile && (
        <DockerfileModal onClose={() => setShowDockerfile(false)} />
      )}
      {showConfig && (
        <ConfigModal onClose={() => setShowConfig(false)} />
      )}
    </div>
  )
}
