import { useState, useEffect, useCallback, useMemo } from 'react'

interface Props {
  onClose: () => void
}

export default function ManageSbxModal({ onClose }: Props) {
  const [sbxList, setSbxList] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [config, setConfig] = useState<SbxPreviewConfig | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const list = await window.api.listSbx()
    setSbxList(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    window.api.getSbxConfig().then(setConfig)
  }, [refresh])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    setMessage(null)
    const result = await window.api.createSbx(newName.trim())
    setMessage({ text: result.message, ok: result.ok })
    setCreating(false)
    if (result.ok) {
      setNewName('')
      refresh()
    }
  }

  const handleDelete = async (name: string) => {
    setDeleting(name)
    setMessage(null)
    const result = await window.api.deleteSbx(name)
    setMessage({ text: result.message, ok: result.ok })
    setDeleting(null)
    if (result.ok) refresh()
  }

  const previewCommands = useMemo(() => {
    if (!config || !newName.trim()) return []
    const name = newName.trim()
    const paths = [config.cloneBase]
    if (config.worktreeBase) paths.push(config.worktreeBase)
    paths.push(...config.mounts)

    const args = ['create', '--name', name]
    if (config.template) args.push('-t', config.template)
    for (const kit of config.kits) args.push('--kit', kit)
    args.push('claude', ...paths)

    const cmds = [`sbx ${args.join(' ')}`]
    for (const cmd of config.postCreateCmds) {
      if (cmd.length > 0) cmds.push(`sbx exec ${name} ${cmd.join(' ')}`)
    }
    for (const pc of config.plugins) {
      cmds.push(`sbx exec ${name} claude plugins marketplace add ${pc.source}`)
      for (const p of pc.plugins) {
        cmds.push(`sbx exec ${name} claude plugins install ${p}`)
      }
    }
    return cmds
  }, [config, newName])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>sbx 管理</h2>

        {message && (
          <div className={`message ${message.ok ? 'message-ok' : 'message-error'}`}>
            {message.text}
          </div>
        )}

        <div className="sbx-list">
          {loading ? (
            <p className="loading-text">読み込み中...</p>
          ) : sbxList.length === 0 ? (
            <p className="loading-text">sbx なし</p>
          ) : (
            sbxList.map((name) => (
              <div key={name} className="sbx-item">
                <span className="sbx-name">{name}</span>
                <button
                  className="btn-danger"
                  onClick={() => setConfirmDelete(name)}
                  disabled={deleting === name}
                >
                  {deleting === name ? '削除中...' : '削除'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sbx-create-row">
          <input
            type="text"
            placeholder="新規 sbx 名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
          <button className="btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? '作成中...' : '作成'}
          </button>
        </div>

        {previewCommands.length > 0 && (
          <div className="command-preview">
            <div className="command-preview-label">COMMANDS</div>
            {previewCommands.map((cmd, i) => (
              <div key={i} className="command-preview-line">{cmd}</div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>削除確認</h2>
            <p><strong>{confirmDelete}</strong> を削除する？</p>
            <div className="modal-actions">
              <button onClick={() => setConfirmDelete(null)}>キャンセル</button>
              <button
                className="btn-danger-confirm"
                onClick={() => {
                  handleDelete(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
