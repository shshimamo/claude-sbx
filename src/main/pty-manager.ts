import * as pty from 'node-pty'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

interface PtySession {
  process: pty.IPty
  sbx: string
  repoPath: string
}

interface Config {
  sbx?: { clone_base?: string; worktree_base?: string }
}

function loadConfig(): Config {
  try {
    const data = readFileSync(join(homedir(), '.claude-sbx', 'config.json'), 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function expandHome(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private counter = 0

  create(sbx: string, repoPath: string, shell?: string): string {
    const id = `session-${Date.now()}-${++this.counter}`
    const loginShell = process.env.SHELL || '/bin/zsh'

    const proc = pty.spawn(loginShell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      env: { ...process.env, TERM: 'xterm-256color' },
    })

    const execCmd = shell || 'claude'
    const cmd = `sbx exec -it ${sbx} sh -c 'cd ${repoPath} && ${execCmd}'`
    proc.write(cmd + '\r')

    this.sessions.set(id, { process: proc, sbx, repoPath })
    return id
  }

  onData(id: string, cb: (data: string) => void) {
    this.sessions.get(id)?.process.onData(cb)
  }

  onExit(id: string, cb: () => void) {
    this.sessions.get(id)?.process.onExit(cb)
  }

  write(id: string, data: string) {
    this.sessions.get(id)?.process.write(data)
  }

  resize(id: string, cols: number, rows: number) {
    this.sessions.get(id)?.process.resize(cols, rows)
  }

  kill(id: string) {
    const session = this.sessions.get(id)
    if (session) {
      session.process.kill()
      this.sessions.delete(id)
    }
  }

  killAll() {
    for (const [id] of this.sessions) {
      this.kill(id)
    }
  }

  listSbx(): string[] {
    try {
      const output = execSync('sbx ls -q', { encoding: 'utf-8', timeout: 5000 })
      return output.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  listRepos(sbxName: string): { path: string; branch: string }[] {
    const cfg = loadConfig()
    const bases: string[] = []
    if (cfg.sbx?.worktree_base) bases.push(expandHome(cfg.sbx.worktree_base))
    const cloneBase = cfg.sbx?.clone_base || '~/src'
    bases.push(expandHome(cloneBase))

    const repos: { path: string; branch: string }[] = []
    for (const base of bases) {
      try {
        const output = execSync(
          `sbx exec ${sbxName} find ${base} -name .git -type d -maxdepth 4`,
          { encoding: 'utf-8', timeout: 10000 },
        )
        for (const line of output.trim().split('\n')) {
          if (!line) continue
          const repoPath = line.replace(/\/\.git$/, '')
          let branch = ''
          try {
            branch = execSync(
              `sbx exec ${sbxName} git -C ${repoPath} rev-parse --abbrev-ref HEAD`,
              { encoding: 'utf-8', timeout: 5000 },
            ).trim()
          } catch { /* ignore */ }
          repos.push({ path: repoPath, branch })
        }
      } catch { /* ignore */ }
    }
    return repos
  }
}
