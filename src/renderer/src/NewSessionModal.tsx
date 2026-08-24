import { useState, useEffect, useMemo, useRef } from 'react'

type Mode = 'existing' | 'worktree' | 'shell'

interface Props {
  onClose: () => void
  onCreate: (sbx: string, repoPath: string, shell?: string) => void
}

export default function NewSessionModal({ onClose, onCreate }: Props) {
  const [sbxList, setSbxList] = useState<string[]>([])
  const [repos, setRepos] = useState<{ path: string; branch: string }[]>([])
  const [selectedSbx, setSelectedSbx] = useState('')
  const [mode, setMode] = useState<Mode>('existing')
  const [loading, setLoading] = useState(true)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [config, setConfig] = useState<SbxPreviewConfig | null>(null)

  // existing / shell mode
  const [selectedRepo, setSelectedRepo] = useState('')
  const [shellCmd, setShellCmd] = useState('zsh')

  // worktree mode
  const [wtRepo, setWtRepo] = useState('')
  const [wtBranch, setWtBranch] = useState('')
  const [wtBase, setWtBase] = useState('')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  // branch suggestions
  const [branchList, setBranchList] = useState<string[]>([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [showBranchList, setShowBranchList] = useState(false)
  const branchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.listSbx().then((list) => {
      setSbxList(list)
      if (list.length > 0) setSelectedSbx(list[0])
      setLoading(false)
    })
    window.api.getSbxConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (!selectedSbx) return
    setRepos([])
    setSelectedRepo('')
    setWtRepo('')
    setBranchList([])
    setLoadingRepos(true)
    window.api.listRepos(selectedSbx).then((list) => {
      setRepos(list)
      if (list.length > 0) {
        setSelectedRepo(list[0].path)
        setWtRepo(list[0].path)
      }
      setLoadingRepos(false)
    })
  }, [selectedSbx])

  // リポジトリ変更時にブランチリストをリセット
  useEffect(() => {
    setBranchList([])
    setWtBranch('')
  }, [wtRepo])

  const filteredBranches = useMemo(() => {
    if (!wtBranch.trim()) return branchList
    const q = wtBranch.trim().toLowerCase()
    return branchList.filter((b) => b.toLowerCase().includes(q))
  }, [branchList, wtBranch])

  const handleBranchFocus = () => {
    if (branchList.length === 0 && selectedSbx && wtRepo) {
      setBranchLoading(true)
      window.api.listBranches(selectedSbx, wtRepo).then((list) => {
        setBranchList(list)
        setShowBranchList(true)
        setBranchLoading(false)
      })
    } else {
      setShowBranchList(true)
    }
  }

  const handleSubmitExisting = () => {
    if (selectedSbx && selectedRepo) {
      onCreate(selectedSbx, selectedRepo)
    }
  }

  const handleSubmitShell = () => {
    if (selectedSbx && selectedRepo) {
      onCreate(selectedSbx, selectedRepo, shellCmd)
    }
  }

  const handleSubmitWorktree = async () => {
    if (!selectedSbx || !wtRepo || !wtBranch) return
    setCreating(true)
    setMessage(null)
    const result = await window.api.createWorktree(wtRepo, wtBranch, wtBase || undefined)
    if (result.ok) {
      onCreate(selectedSbx, result.wtPath)
    } else {
      setMessage({ text: result.message, ok: false })
      setCreating(false)
    }
  }

  const previewCommand = useMemo(() => {
    if (!selectedSbx) return []
    if (mode === 'existing') {
      if (!selectedRepo) return []
      return [`sbx exec -it ${selectedSbx} sh -c 'cd ${selectedRepo} && claude'`]
    }
    if (mode === 'shell') {
      if (!selectedRepo) return []
      return [`sbx exec -it ${selectedSbx} sh -c 'cd ${selectedRepo} && ${shellCmd}'`]
    }
    if (!wtRepo || !wtBranch) return []
    const repoName = wtRepo.split('/').pop()
    const wtBase_ = config?.worktreeBase || '~/worktrees'
    const isPR = wtBranch.startsWith('https://github.com/') && wtBranch.includes('/pull/')
    if (isPR) {
      return [`(PR link → ブランチ名を自動解決して worktree 作成)`]
    }
    const safeBranch = wtBranch.replace(/\//g, '__')
    return [
      `git worktree add ${wtBase_}/${repoName}/${safeBranch}${wtBase ? ` (base: ${wtBase})` : ''}`,
      `sbx exec -it ${selectedSbx} sh -c 'cd ${wtBase_}/${repoName}/${safeBranch} && claude'`,
    ]
  }, [selectedSbx, mode, selectedRepo, shellCmd, wtRepo, wtBranch, wtBase, config])

  const canSubmit = mode === 'worktree'
    ? selectedSbx && wtRepo && wtBranch
    : selectedSbx && selectedRepo

  const handleSubmit = mode === 'existing'
    ? handleSubmitExisting
    : mode === 'shell'
      ? handleSubmitShell
      : handleSubmitWorktree

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
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

            <div className="mode-tabs">
              <button
                className={`mode-tab ${mode === 'existing' ? 'mode-tab-active' : ''}`}
                onClick={() => setMode('existing')}
              >
                Existing repo
              </button>
              <button
                className={`mode-tab ${mode === 'worktree' ? 'mode-tab-active' : ''}`}
                onClick={() => setMode('worktree')}
              >
                New worktree
              </button>
              <button
                className={`mode-tab ${mode === 'shell' ? 'mode-tab-active' : ''}`}
                onClick={() => setMode('shell')}
              >
                Shell
              </button>
            </div>

            {(mode === 'existing' || mode === 'shell') && (
              <>
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
                {mode === 'shell' && (
                  <label>
                    Shell
                    <select value={shellCmd} onChange={(e) => setShellCmd(e.target.value)}>
                      <option value="zsh">zsh</option>
                      <option value="bash">bash</option>
                    </select>
                  </label>
                )}
              </>
            )}

            {mode === 'worktree' && (
              <>
                <label>
                  Repository
                  {loadingRepos ? (
                    <p className="loading-text">リポジトリ取得中...</p>
                  ) : (
                    <select value={wtRepo} onChange={(e) => setWtRepo(e.target.value)}>
                      {repos.map((r) => (
                        <option key={r.path} value={r.path}>
                          {r.path.split('/').pop()} {r.branch && `(${r.branch})`}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Branch / PR Link
                  <span className="tooltip-wrap">
                    <span className="tooltip-icon">?</span>
                    <span className="tooltip-content">
                      PR の URL を入力すると自動でブランチ名を解決{'\n'}
                      1. worktree が既に存在 → そのまま使用{'\n'}
                      2. origin/branch が存在 → リモートブランチから作成{'\n'}
                      3. ローカルに branch が存在 → ローカルブランチから作成{'\n'}
                      4. どちらもない → base branch から新規作成
                    </span>
                  </span>
                  <div className="branch-suggest-wrap">
                    <input
                      ref={branchRef}
                      type="text"
                      className="modal-input"
                      value={wtBranch}
                      onChange={(e) => { setWtBranch(e.target.value); setShowBranchList(true) }}
                      onFocus={handleBranchFocus}
                      onBlur={() => setTimeout(() => setShowBranchList(false), 200)}
                      placeholder={branchLoading ? '読み込み中...' : 'e.g. feature/xxx or https://github.com/.../pull/123'}
                    />
                    {showBranchList && filteredBranches.length > 0 && (
                      <div className="branch-suggest-list">
                        {filteredBranches.slice(0, 20).map((b) => (
                          <div
                            key={b}
                            className="branch-suggest-item"
                            onMouseDown={() => { setWtBranch(b); setShowBranchList(false) }}
                          >
                            {b}
                          </div>
                        ))}
                        {filteredBranches.length > 20 && (
                          <div className="branch-suggest-item" style={{ opacity: 0.5 }}>
                            ...他 {filteredBranches.length - 20} 件
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
                <label>
                  Base Branch <span className="label-hint">任意</span>
                  <input
                    type="text"
                    className="modal-input"
                    value={wtBase}
                    onChange={(e) => setWtBase(e.target.value)}
                    placeholder="e.g. main, develop"
                  />
                </label>
              </>
            )}

            {message && (
              <div className={`message ${message.ok ? 'message-ok' : 'message-error'}`}>
                {message.text}
              </div>
            )}

            {previewCommand.length > 0 && (
              <div className="command-preview">
                <div className="command-preview-label">実行コマンド</div>
                {previewCommand.map((cmd, i) => (
                  <div key={i} className="command-preview-line">{cmd}</div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button onClick={onClose}>キャンセル</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit || creating}
              >
                {creating ? '作成中...' : '作成'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
