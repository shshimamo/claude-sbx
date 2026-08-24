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
      'default_mounts', 'kits', 'post_create_cmds', 'plugins',
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
    // plugins の source マウントチェック
    const sbx = obj.sbx as Record<string, unknown> | undefined
    if (sbx) {
      const plugins = sbx.plugins as { source: string; plugins: string[] }[] | undefined
      if (Array.isArray(plugins)) {
        const cloneBase = (sbx.clone_base as string) || '~/src'
        const worktreeBase = (sbx.worktree_base as string) || ''
        const mounts = ((sbx.default_mounts as string[]) || []).map((m) => m.split(':')[0])
        const mountedPaths = [cloneBase, ...(worktreeBase ? [worktreeBase] : []), ...mounts]

        for (const pc of plugins) {
          const source = pc.source || ''
          if (source.startsWith('~/') || source.startsWith('/')) {
            const isMounted = mountedPaths.some((m) => source === m || source.startsWith(m + '/'))
            if (!isMounted) {
              warnings.push(`plugin source "${source}" がマウント対象に含まれていない`)
            }
          }
        }
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
