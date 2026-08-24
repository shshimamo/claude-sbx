import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
  onCreate: (sbx: string, repoPath: string) => void
}

export default function NewSessionModal({ onClose, onCreate }: Props) {
  const [sbxList, setSbxList] = useState<string[]>([])
  const [repos, setRepos] = useState<{ path: string; branch: string }[]>([])
  const [selectedSbx, setSelectedSbx] = useState('')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingRepos, setLoadingRepos] = useState(false)

  useEffect(() => {
    window.api.listSbx().then((list) => {
      setSbxList(list)
      if (list.length > 0) setSelectedSbx(list[0])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedSbx) return
    setRepos([])
    setSelectedRepo('')
    setLoadingRepos(true)
    window.api.listRepos(selectedSbx).then((list) => {
      setRepos(list)
      if (list.length > 0) setSelectedRepo(list[0].path)
      setLoadingRepos(false)
    })
  }, [selectedSbx])

  const handleSubmit = () => {
    if (selectedSbx && selectedRepo) {
      onCreate(selectedSbx, selectedRepo)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>新規セッション</h2>
        {loading ? (
          <p>読み込み中...</p>
        ) : (
          <>
            <label>
              sbx
              <select value={selectedSbx} onChange={(e) => setSelectedSbx(e.target.value)}>
                {sbxList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Repository
              {loadingRepos ? (
                <p className="loading-text">リポジトリ取得中...</p>
              ) : (
                <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)}>
                  {repos.map((r) => (
                    <option key={r.path} value={r.path}>
                      {r.path.split('/').pop()} {r.branch && `(${r.branch})`}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <div className="modal-actions">
              <button onClick={onClose}>キャンセル</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!selectedSbx || !selectedRepo}>
                作成
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
