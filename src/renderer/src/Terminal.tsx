import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
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

const terminals = new Map<string, { xterm: XTerm; fitAddon: FitAddon }>()

export default function Terminal({ sessionId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

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
    xterm.loadAddon(fitAddon)
    xterm.open(containerRef.current)
    fitAddon.fit()

    // ユーザー入力を pty に送信
    xterm.onData((data) => {
      window.api.writePty(sessionId, data)
    })

    // リサイズ
    xterm.onResize(({ cols, rows }) => {
      window.api.resizePty(sessionId, cols, rows)
    })

    terminals.set(sessionId, { xterm, fitAddon })
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

  return <div ref={containerRef} className="terminal-container" />
}
