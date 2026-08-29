import { watch, readFileSync, readdirSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface HookEvent {
  event: string
  claude_sbx_id?: string
  data?: {
    session_id?: string
    cwd?: string
    [key: string]: unknown
  }
}

export class HookWatcher {
  private dir: string
  private watcher: ReturnType<typeof watch> | null = null
  private onEvent: ((hookEvent: HookEvent) => void) | null = null

  constructor(dir: string) {
    this.dir = dir
    mkdirSync(this.dir, { recursive: true })
  }

  setOnEvent(cb: (hookEvent: HookEvent) => void): void {
    this.onEvent = cb
  }

  start(): void {
    this.watcher = watch(this.dir, (_eventType, filename) => {
      if (!filename?.endsWith('.json')) return

      const filePath = join(this.dir, filename)
      setTimeout(() => {
        // 古いファイルを削除（最新のみ残す）
        try {
          for (const f of readdirSync(this.dir)) {
            if (f !== filename && f.endsWith('.json')) {
              try { unlinkSync(join(this.dir, f)) } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }

        try {
          const content = readFileSync(filePath, 'utf-8')
          const hookEvent: HookEvent = JSON.parse(content)
          if (this.onEvent) this.onEvent(hookEvent)
        } catch {
          /* ignore read/parse errors */
        }
      }, 50)
    })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }
}
