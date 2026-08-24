import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
}

export default function ConfigModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    window.api.getConfig().then((text) => {
      setContent(text)
      setLoading(false)
    })
  }, [])

  const validateKeys = (obj: Record<string, unknown>): string[] => {
    const topAllowed = new Set(['sbx'])
    const sbxAllowed = new Set([
      'template', 'clone_base', 'worktree_base',
      'default_mounts', 'kits', 'post_create_cmds',
    ])
    const warnings: string[] = []

    for (const key of Object.keys(obj)) {
      if (!topAllowed.has(key)) warnings.push(`不明なキー: "${key}"`)
    }
    if (obj.sbx && typeof obj.sbx === 'object') {
      for (const key of Object.keys(obj.sbx as Record<string, unknown>)) {
        if (!sbxAllowed.has(key)) warnings.push(`不明なキー: sbx."${key}"`)
      }
    }
    return warnings
  }

  const handleSave = async () => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content)
    } catch {
      setMessage({ text: 'JSON の構文エラー', ok: false })
      return
    }

    const warnings = validateKeys(parsed)
    await window.api.saveConfig(content)

    if (warnings.length > 0) {
      setMessage({ text: `保存完了（警告: ${warnings.join(', ')}）`, ok: true })
    } else {
      setMessage({ text: '保存完了', ok: true })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>config.json</h2>

        {message && (
          <div className={`message ${message.ok ? 'message-ok' : 'message-error'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <p className="loading-text">読み込み中...</p>
        ) : (
          <textarea
            className="dockerfile-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />
        )}

        <div className="modal-actions">
          <button onClick={onClose}>閉じる</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
