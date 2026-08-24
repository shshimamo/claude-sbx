import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
}

export default function DockerfileModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [config, setConfig] = useState<SbxPreviewConfig | null>(null)

  useEffect(() => {
    window.api.getDockerfile().then((text) => {
      setContent(text)
      setLoading(false)
    })
    window.api.getSbxConfig().then(setConfig)
  }, [])

  const handleSave = async () => {
    await window.api.saveDockerfile(content)
    setMessage({ text: '保存完了', ok: true })
  }

  const handleBuild = async () => {
    setBuilding(true)
    setMessage(null)
    await window.api.saveDockerfile(content)
    const result = await window.api.buildTemplate()
    setMessage({ text: result.message, ok: result.ok })
    setBuilding(false)
  }

  const buildCommands = config ? [
    `docker build -t ${config.template} -f ${config.claudeTabsDir}/Dockerfile ${config.claudeTabsDir}/`,
    `docker save ${config.template} -o <tmpfile>`,
    `sbx template load <tmpfile>`,
  ] : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>Dockerfile テンプレート</h2>

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

        {buildCommands.length > 0 && (
          <div className="command-preview">
            <div className="command-preview-label">BUILD COMMANDS</div>
            {buildCommands.map((cmd, i) => (
              <div key={i} className="command-preview-line">{cmd}</div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>閉じる</button>
          <button onClick={handleSave} disabled={loading}>保存</button>
          <button className="btn-primary" onClick={handleBuild} disabled={building || loading}>
            {building ? 'ビルド中...' : 'ビルド & ロード'}
          </button>
        </div>
      </div>
    </div>
  )
}
