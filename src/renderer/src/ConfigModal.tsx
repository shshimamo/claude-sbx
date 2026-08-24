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

  const handleSave = async () => {
    try {
      JSON.parse(content)
    } catch {
      setMessage({ text: 'JSON の構文エラー', ok: false })
      return
    }
    await window.api.saveConfig(content)
    setMessage({ text: '保存完了', ok: true })
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
