interface Props {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewSession: () => void
  onManageSbx: () => void
  onDockerfile: () => void
  onConfig: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#a6e3a1' },
  ai_working: { label: 'AI Working', color: '#f9e2af' },
  waiting_input: { label: 'Input', color: '#89b4fa' },
  permission_required: { label: 'Permission', color: '#f38ba8' },
  idle: { label: 'Idle', color: '#6c7086' },
  terminated: { label: 'Ended', color: '#585b70' },
}

export default function Sidebar({ sessions, activeId, onSelect, onClose, onNewSession, onManageSbx, onDockerfile, onConfig }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Claude Sbx</h1>
        <button className="btn-new" onClick={onNewSession}>+</button>
      </div>
      <div className="sidebar-toolbar">
        <button className="btn-toolbar" onClick={onManageSbx}>sbx 管理</button>
        <button className="btn-toolbar" onClick={onDockerfile}>Dockerfile</button>
        <button className="btn-toolbar" onClick={onConfig}>Config</button>
      </div>
      <div className="session-list">
        {sessions.map((s) => {
          const st = STATUS_LABELS[s.status] || STATUS_LABELS.active
          return (
            <div
              key={s.id}
              className={`session-item ${s.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(s.id)}
            >
              <span className="status-dot" style={{ background: st.color }} />
              <div className="session-info">
                <div className="session-name">{s.repoPath.split('/').pop()}</div>
                <div className="session-meta">{s.sbx} &middot; {st.label}</div>
              </div>
              <button
                className="btn-close"
                onClick={(e) => { e.stopPropagation(); onClose(s.id) }}
              >
                &times;
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
