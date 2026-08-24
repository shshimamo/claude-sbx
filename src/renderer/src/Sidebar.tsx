import { useState, useRef, useEffect } from 'react'

interface Props {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onNewSession: () => void
  onManageSbx: () => void
  onDockerfile: () => void
  onConfig: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#a6e3a1' },
  terminated: { label: 'Ended', color: '#585b70' },
}

export default function Sidebar({ sessions, activeId, onSelect, onClose, onRename, onNewSession, onManageSbx, onDockerfile, onConfig }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) editRef.current?.focus()
  }, [editingId])

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Claude Sbx</h1>
        <div className="sidebar-header-actions">
          <button className="btn-new" onClick={onNewSession}>+</button>
          <div className="gear-wrap" ref={menuRef}>
            <button className="btn-gear" onClick={() => setMenuOpen(!menuOpen)}>&#9881;</button>
            {menuOpen && (
              <div className="gear-menu">
                <div className="gear-menu-item" onClick={() => { onManageSbx(); setMenuOpen(false) }}>sbx 管理</div>
                <div className="gear-menu-item" onClick={() => { onDockerfile(); setMenuOpen(false) }}>Dockerfile</div>
                <div className="gear-menu-item" onClick={() => { onConfig(); setMenuOpen(false) }}>Config</div>
              </div>
            )}
          </div>
        </div>
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
                {editingId === s.id ? (
                  <input
                    ref={editRef}
                    className="session-name-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="session-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingId(s.id)
                      setEditValue(s.name)
                    }}
                  >{s.name}</div>
                )}
                <div className="session-meta">{s.sbx}</div>
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
