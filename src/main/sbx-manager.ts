import { execSync, exec } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { tmpdir } from 'os'

interface PluginConfig {
  source: string
  plugins: string[]
}

interface SbxConfig {
  template?: string
  clone_base?: string
  worktree_base?: string
  mounts?: string[]
  kits?: string[]
  post_create_cmds?: string[][]
  plugins?: PluginConfig[]
}

interface Config {
  sbx?: SbxConfig
}

const DEFAULT_CONFIG: Config = {
  sbx: {
    clone_base: '~/src',
    worktree_base: '~/worktrees',
  },
}

const DEFAULT_DOCKERFILE = `FROM docker/sandbox-templates:claude-code

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \\
    zsh \\
    curl \\
    jq \\
    make \\
    vim \\
    git \\
    && rm -rf /var/lib/apt/lists/*

RUN chsh -s /usr/bin/zsh agent

USER agent
`

function ensureDefaults(): void {
  const dir = join(homedir(), '.claude-sbx')
  mkdirSync(dir, { recursive: true })

  const configPath = join(dir, 'config.json')
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf-8')
  }

  const dockerfilePath = join(dir, 'Dockerfile')
  if (!existsSync(dockerfilePath)) {
    writeFileSync(dockerfilePath, DEFAULT_DOCKERFILE, 'utf-8')
  }
}

function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.claude-sbx', 'config.json'), 'utf-8'))
  } catch {
    return DEFAULT_CONFIG
  }
}

function expandHome(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p
}

export class SbxManager {
  constructor() {
    ensureDefaults()
  }

  list(): string[] {
    try {
      return execSync('sbx ls -q', { encoding: 'utf-8', timeout: 5000 })
        .trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  create(name: string): { ok: boolean; message: string } {
    const cfg = loadConfig()
    const cloneBase = expandHome(cfg.sbx?.clone_base || '~/src')
    const paths = [cloneBase]
    if (cfg.sbx?.worktree_base) paths.push(expandHome(cfg.sbx.worktree_base!))
    if (cfg.sbx?.mounts) paths.push(...cfg.sbx.mounts.map(expandHome))

    const args = ['create', '--name', name]
    if (cfg.sbx?.template) args.push('-t', cfg.sbx.template)
    if (cfg.sbx?.kits) {
      for (const kit of cfg.sbx.kits) args.push('--kit', kit)
    }
    args.push('claude', ...paths)

    try {
      execSync(`sbx ${args.join(' ')}`, { encoding: 'utf-8', timeout: 60000 })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `sbx create failed: ${msg}` }
    }

    // post-create commands
    if (cfg.sbx?.post_create_cmds) {
      for (const cmd of cfg.sbx.post_create_cmds) {
        if (cmd.length > 0) {
          try {
            const expanded = cmd.map(expandHome)
            execSync(`sbx exec ${name} ${expanded.join(' ')}`, { timeout: 30000 })
          } catch { /* ignore */ }
        }
      }
    }

    // plugins install
    if (cfg.sbx?.plugins) {
      const mountedPaths = this.getMountedPaths(cfg)
      for (const pc of cfg.sbx.plugins) {
        const source = expandHome(pc.source)
        if (this.isLocalPath(source) && !this.isPathMounted(source, mountedPaths)) {
          return { ok: true, message: `sbx created: ${name}（警告: plugin source "${pc.source}" がマウントされていない）` }
        }
        try {
          execSync(`sbx exec ${name} claude plugins marketplace add ${source}`, { timeout: 30000 })
        } catch { /* ignore */ }
        for (const plugin of pc.plugins) {
          try {
            execSync(`sbx exec ${name} claude plugins install ${plugin}`, { timeout: 30000 })
          } catch { /* ignore */ }
        }
      }
    }

    return { ok: true, message: `sbx created: ${name}` }
  }

  private isLocalPath(p: string): boolean {
    return p.startsWith('/') || p.startsWith('~/')
  }

  private getMountedPaths(cfg: Config): string[] {
    const paths = [expandHome(cfg.sbx?.clone_base || '~/src')]
    if (cfg.sbx?.worktree_base) paths.push(expandHome(cfg.sbx.worktree_base))
    if (cfg.sbx?.mounts) {
      paths.push(...cfg.sbx.mounts.map((m) => expandHome(m.split(':')[0])))
    }
    return paths
  }

  private isPathMounted(source: string, mountedPaths: string[]): boolean {
    return mountedPaths.some((m) => source === m || source.startsWith(m + '/'))
  }

  delete(name: string): { ok: boolean; message: string } {
    try {
      execSync(`sbx rm -f ${name}`, { encoding: 'utf-8', timeout: 15000 })
      return { ok: true, message: `sbx deleted: ${name}` }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `sbx rm failed: ${msg}` }
    }
  }

  listRepos(sbxName: string): { path: string; branch: string }[] {
    const cfg = loadConfig()
    const bases: string[] = []
    if (cfg.sbx?.worktree_base) bases.push(expandHome(cfg.sbx.worktree_base!))
    bases.push(expandHome(cfg.sbx?.clone_base || '~/src'))

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

  // ブランチ一覧取得
  listBranches(sbxName: string, repoPath: string): string[] {
    try {
      const output = execSync(
        `sbx exec ${sbxName} git -C ${repoPath} branch -r --format='%(refname:short)'`,
        { encoding: 'utf-8', timeout: 10000 },
      )
      return output.trim().split('\n')
        .filter(Boolean)
        .map((b) => b.replace(/^origin\//, ''))
        .filter((b) => b !== 'HEAD')
    } catch {
      return []
    }
  }

  // PR URL → ブランチ名解決
  private resolveBranch(input: string): { branch: string; prNumber: string } {
    if (input.startsWith('https://github.com/') && input.includes('/pull/')) {
      const parts = input.split('/pull/')
      const prNumber = parts[1]?.replace(/\/$/, '') || ''
      try {
        const branch = execSync(
          `gh pr view ${input} --json headRefName -q .headRefName`,
          { encoding: 'utf-8', timeout: 15000 },
        ).trim()
        return { branch, prNumber }
      } catch {
        throw new Error(`PR の解決に失敗: ${input}`)
      }
    }
    return { branch: input, prNumber: '' }
  }

  // worktree 作成（ホスト側で git worktree add → sbx からマウント経由でアクセス）
  createWorktree(repo: string, branchInput: string, baseBranch?: string): { ok: boolean; wtPath: string; message: string } {
    let branch: string
    let prNumber: string
    try {
      ({ branch, prNumber } = this.resolveBranch(branchInput))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, wtPath: '', message: msg }
    }

    const cfg = loadConfig()
    const cloneBase = expandHome(cfg.sbx?.clone_base || '~/src')
    const repoName = basename(repo)

    // clone_base からリポジトリを探す
    let repoPath = ''
    try {
      const output = execSync(`find ${cloneBase} -name .git -type d -maxdepth 4`, { encoding: 'utf-8', timeout: 10000 })
      for (const line of output.trim().split('\n')) {
        if (!line) continue
        const dir = line.replace(/\/\.git$/, '')
        if (basename(dir) === repoName || dir === repo) {
          repoPath = dir
          break
        }
      }
    } catch { /* ignore */ }
    if (!repoPath) {
      return { ok: false, wtPath: '', message: `Repository not found: ${repoName}` }
    }

    const wtBase = expandHome(cfg.sbx?.worktree_base || '~/worktrees')
    const dirPrefix = prNumber ? `pr${prNumber}-` : ''
    const safeBranch = branch.replace(/\//g, '__')
    const wtPath = join(wtBase, repoName, dirPrefix + safeBranch)

    if (existsSync(wtPath)) {
      return { ok: true, wtPath, message: `Worktree already exists: ${wtPath}` }
    }

    // git fetch
    try {
      execSync(`git -C ${repoPath} fetch origin`, { timeout: 30000 })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, wtPath: '', message: `git fetch failed: ${msg}` }
    }

    // base branch 検証
    if (baseBranch) {
      try {
        execSync(`git -C ${repoPath} rev-parse --verify ${baseBranch}`, { timeout: 5000 })
      } catch {
        try {
          execSync(`git -C ${repoPath} rev-parse --verify origin/${baseBranch}`, { timeout: 5000 })
        } catch {
          return { ok: false, wtPath: '', message: `Base branch not found: ${baseBranch}` }
        }
      }
    }

    // remote branch の存在確認
    let isRemote = false
    try {
      execSync(`git -C ${repoPath} rev-parse origin/${branch}`, { timeout: 5000 })
      isRemote = true
    } catch { /* not remote */ }

    try {
      if (isRemote) {
        execSync(`git -C ${repoPath} worktree add ${wtPath} origin/${branch}`, { timeout: 30000 })
      } else {
        // ローカルブランチ確認
        let isLocal = false
        try {
          execSync(`git -C ${repoPath} rev-parse --verify ${branch}`, { timeout: 5000 })
          isLocal = true
        } catch { /* new branch */ }

        if (isLocal) {
          execSync(`git -C ${repoPath} worktree add ${wtPath} ${branch}`, { timeout: 30000 })
        } else {
          const args = [`-C`, repoPath, `worktree`, `add`, wtPath, `-b`, branch]
          if (baseBranch) args.push(baseBranch)
          execSync(`git ${args.join(' ')}`, { timeout: 30000 })
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, wtPath: '', message: `git worktree add failed: ${msg}` }
    }

    return { ok: true, wtPath, message: `Worktree created: ${wtPath}` }
  }

  // コマンドプレビュー用の config 情報
  getPreviewConfig(): {
    template: string
    cloneBase: string
    worktreeBase: string
    mounts: string[]
    kits: string[]
    postCreateCmds: string[][]
    plugins: { source: string; plugins: string[] }[]
  } {
    const cfg = loadConfig()
    return {
      template: cfg.sbx?.template || '',
      cloneBase: cfg.sbx?.clone_base || '~/src',
      worktreeBase: cfg.sbx?.worktree_base || '',
      mounts: cfg.sbx?.mounts || [],
      kits: cfg.sbx?.kits || [],
      postCreateCmds: cfg.sbx?.post_create_cmds || [],
      plugins: cfg.sbx?.plugins || [],
    }
  }

  // Dockerfile テンプレート
  getDockerfile(): string {
    const path = join(homedir(), '.claude-sbx', 'Dockerfile')
    try {
      return readFileSync(path, 'utf-8')
    } catch {
      return DEFAULT_DOCKERFILE
    }
  }

  saveDockerfile(content: string): void {
    const dir = join(homedir(), '.claude-sbx')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'Dockerfile'), content, 'utf-8')
  }

  getConfig(): string {
    const path = join(homedir(), '.claude-sbx', 'config.json')
    try {
      return readFileSync(path, 'utf-8')
    } catch {
      return JSON.stringify(DEFAULT_CONFIG, null, 2)
    }
  }

  saveConfig(content: string): void {
    const dir = join(homedir(), '.claude-sbx')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'config.json'), content, 'utf-8')
  }

  buildTemplate(cb: (result: { ok: boolean; message: string }) => void): void {
    const dockerfilePath = join(homedir(), '.claude-sbx', 'Dockerfile')
    const cfg = loadConfig()
    const tag = cfg.sbx?.template
    if (!tag) {
      cb({ ok: false, message: 'config.json に sbx.template を設定してください' })
      return
    }
    const dir = join(homedir(), '.claude-sbx')

    // 非同期で実行（ビルドに時間がかかるため）
    exec(`docker build -t ${tag} -f ${dockerfilePath} ${dir}`, { timeout: 300000 }, (err, _stdout, stderr) => {
      if (err) {
        cb({ ok: false, message: `docker build failed: ${stderr}` })
        return
      }
      const tmpFile = join(tmpdir(), `sbx-template-${Date.now()}.tar`)
      exec(`docker save ${tag} -o ${tmpFile}`, { timeout: 120000 }, (err2, _stdout2, stderr2) => {
        if (err2) {
          cb({ ok: false, message: `docker save failed: ${stderr2}` })
          return
        }
        exec(`sbx template load ${tmpFile}`, { timeout: 120000 }, (err3, _stdout3, stderr3) => {
          try { require('fs').unlinkSync(tmpFile) } catch { /* ignore */ }
          if (err3) {
            cb({ ok: false, message: `sbx template load failed: ${stderr3}` })
            return
          }
          cb({ ok: true, message: `Template '${tag}' built and loaded successfully` })
        })
      })
    })
  }
}
