import { watch, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { Notification } from 'electron'

const EVENT_TITLES: Record<string, string> = {
  Stop: 'タスク完了',
  PermissionRequest: '許可待ち',
  AskUserQuestion: '質問あり',
  SessionStart: 'セッション開始',
  SessionEnd: 'セッション終了',
}

interface HookEvent {
  event: string
  data?: {
    session_id?: string
    cwd?: string
    [key: string]: unknown
  }
}

export class HookWatcher {
  private dir: string
  private watcher: ReturnType<typeof watch> | null = null
  private events: string[] = []

  constructor() {
    this.dir = join(homedir(), '.claude-sbx', 'sessions')
    mkdirSync(this.dir, { recursive: true })
  }

  setEvents(events: string[]): void {
    this.events = events
  }

  start(): void {
    this.watcher = watch(this.dir, (_eventType, filename) => {
      if (!filename?.endsWith('.json')) return

      // 少し待ってからファイルを読む（書き込み完了を待つ）
      setTimeout(() => {
        try {
          const content = readFileSync(join(this.dir, filename), 'utf-8')
          const hookEvent: HookEvent = JSON.parse(content)
          this.handleEvent(hookEvent)
        } catch {
          /* ignore read/parse errors */
        }
      }, 50)
    })
  }

  private handleEvent(hookEvent: HookEvent): void {
    if (this.events.length === 0) return
    if (!this.events.includes(hookEvent.event)) return

    const title = EVENT_TITLES[hookEvent.event] || hookEvent.event
    const cwd = hookEvent.data?.cwd || ''
    const body = cwd ? cwd.split('/').pop() || '' : hookEvent.data?.session_id || ''

    new Notification({ title, body }).show()
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }
}
