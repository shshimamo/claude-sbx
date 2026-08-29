import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

interface Props {
  sessionId: string
  active: boolean
}

// Catppuccin Mocha theme
const theme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b7066',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
}

const terminals = new Map<string, { xterm: XTerm; fitAddon: FitAddon; searchAddon: SearchAddon }>()

export default function Terminal({ sessionId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [showSearch, setShowSearch] = useState(false)

  // xterm 初期化（1回だけ）
  useEffect(() => {
    if (!containerRef.current) return
    if (terminals.has(sessionId)) return

    const xterm = new XTerm({
      theme,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    xterm.loadAddon(fitAddon)
    xterm.loadAddon(searchAddon)
    xterm.open(containerRef.current)
    requestAnimationFrame(() => fitAddon.fit())

    // OSC 52 (クリップボード書き込み) をハンドリング
    xterm.parser.registerOscHandler(52, (data) => {
      const parts = data.split(';')
      if (parts.length >= 2 && parts[1]) {
        try {
          const bytes = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))
          const text = new TextDecoder().decode(bytes)
          window.api.clipboardWrite(text)
        } catch { /* ignore invalid base64 */ }
      }
      return true
    })

    // テキスト選択時に自動でクリップボードにコピー
    xterm.onSelectionChange(() => {
      if (xterm.hasSelection()) {
        window.api.clipboardWrite(xterm.getSelection())
      }
    })

    // ユーザー入力を pty に送信
    xterm.onData((data) => {
      window.api.writePty(sessionId, data)
    })

    // リサイズ
    xterm.onResize(({ cols, rows }) => {
      window.api.resizePty(sessionId, cols, rows)
    })

    terminals.set(sessionId, { xterm, fitAddon, searchAddon })
  }, [sessionId])

  // pty データリスナー（StrictMode で再登録されても正しく動く）
  useEffect(() => {
    const t = terminals.get(sessionId)
    if (!t) return

    const unsub = window.api.onPtyData((id, data) => {
      if (id === sessionId) t.xterm.write(data)
    })

    // main にバッファ再生を要求
    window.api.ptyReady(sessionId)

    return () => {
      unsub()
    }
  }, [sessionId])

  // アクティブタブ切り替え時にリサイズ
  useEffect(() => {
    if (active) {
      const t = terminals.get(sessionId)
      if (t) {
        requestAnimationFrame(() => t.fitAddon.fit())
        t.xterm.focus()
      }
    }
  }, [active, sessionId])

  // Cmd+F で検索バー表示
  useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch((prev) => {
          if (prev) {
            // 閉じる時に検索ハイライトをクリア
            const t = terminals.get(sessionId)
            if (t) {
              t.searchAddon.clearDecorations()
              t.xterm.focus()
            }
            return false
          }
          return true
        })
      }
      if (e.key === 'Escape' && showSearch) {
        const t = terminals.get(sessionId)
        if (t) {
          t.searchAddon.clearDecorations()
          t.xterm.focus()
        }
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, sessionId, showSearch])

  // 検索バー表示時にフォーカス
  useEffect(() => {
    if (showSearch) searchRef.current?.focus()
  }, [showSearch])

  const handleSearch = (value: string) => {
    const t = terminals.get(sessionId)
    if (!t) return
    if (value) {
      t.searchAddon.findNext(value)
    } else {
      t.searchAddon.clearDecorations()
    }
  }

  // ウィンドウリサイズ対応
  useEffect(() => {
    const handleResize = () => {
      if (active) {
        const t = terminals.get(sessionId)
        if (t) t.fitAddon.fit()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [active, sessionId])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {showSearch && (
        <div className="search-bar">
          <input
            ref={searchRef}
            type="text"
            placeholder="検索..."
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const t = terminals.get(sessionId)
                if (t) {
                  if (e.shiftKey) t.searchAddon.findPrevious(e.currentTarget.value)
                  else t.searchAddon.findNext(e.currentTarget.value)
                }
              }
              if (e.key === 'Escape') {
                const t = terminals.get(sessionId)
                if (t) {
                  t.searchAddon.clearDecorations()
                  t.xterm.focus()
                }
                setShowSearch(false)
              }
            }}
          />
        </div>
      )}
      <div ref={containerRef} className="terminal-container" />
    </div>
  )
}
