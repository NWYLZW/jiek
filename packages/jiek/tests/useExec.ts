import { exec, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type { TestContext } from 'vitest'
import { afterAll, beforeAll, describe as vitestDescribe, test as vitestTest } from 'vitest'

const resolveByFixtures = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

function snapshotDir({ expect }: TestContext, dir: string, remove = true) {
  const files = fs.readdirSync(dir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    if (fs.statSync(path.resolve(dir, file)).isDirectory()) return
    expect(`${file}:\n${fs.readFileSync(path.resolve(dir, file), 'utf-8')}`).toMatchSnapshot()
  })
  if (remove) {
    void fs.promises.rm(dir, { recursive: true })
  }
}

async function execWithRoot(root: string, cmd: string) {
  const cliBinPath = path.resolve(__dirname, '../bin/jiek.js')
  const args = ['node', cliBinPath, cmd].join(' ')
  const p = exec(args, {
    cwd: root,
    env: {
      ...process.env,
      JIEK_ROOT: root
    }
  })
  let stdout = ''
  p.stdout?.on('data', data => {
    stdout += data
  })
  let stderr = ''
  p.stderr?.on('data', data => {
    stderr += data
  })
  return new Promise<void>((resolve, reject) => {
    p.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`exit code: ${code}\n${stdout}\n${stderr}`))
      }
    })
  })
}

interface CtxExecOptions {
  cmd?: string
  moreOptions?: string[]
  overrideOptions?: string[]
  autoSnapDist?: boolean | string
  remove?: boolean
}

interface Ctx {
  root: string
  exec: (options?: CtxExecOptions) => Promise<void>
}

interface CreateUseExecOptions {
  cmd?: string
  cmdOptions?: string[]
  cmdOptionsMap?: Record<string, string[]>
}

function createUseExec(options: CreateUseExecOptions) {
  return function useExec(...paths: string[]) {
    const root = resolveByFixtures(paths)
    const resolveByRoot = (...paths: string[]) => path.resolve(root, ...paths)
    const notWorkspace = !fs.existsSync(path.resolve(root, 'pnpm-workspace.yaml'))
    beforeAll(() => {
      const args = [
        'pnpm i',
        notWorkspace ? '--ignore-workspace' : null
      ].filter(Boolean).join(' ')
      execSync(args, {
        cwd: root,
        stdio: ['ignore', 'ignore', 'inherit']
      })
    })
    afterAll(async () => {
      const nodeModulesPath = path.resolve(root, 'node_modules')
      if (fs.existsSync(nodeModulesPath)) {
        void fs.promises.rm(nodeModulesPath, { recursive: true })
      }

      const packagesPath = path.resolve(root, 'packages')
      if (!fs.existsSync(packagesPath)) return
      if (!fs.statSync(packagesPath).isDirectory()) return

      const files = await fs.promises.readdir(packagesPath)
      files
        .forEach(pkg => {
          if (typeof pkg !== 'string') return
          const nodeModulesPath = resolveByRoot('packages', pkg, 'node_modules')
          if (!fs.existsSync(nodeModulesPath)) return
          if (!fs.statSync(nodeModulesPath).isDirectory()) return
          void fs.promises.rm(nodeModulesPath, { recursive: true })
        })
    })
    let defaultCmd = options.cmd ?? ''
    let defaultCmdOptionsMap: Record<string, string[]> = Object.assign(
      {},
      options.cmdOptions
        ? { [defaultCmd]: options.cmdOptions }
        : {},
      options.cmdOptionsMap ?? {}
    )
    const setup = (options: {
      cmd: string
      cmdOptionsMap: Record<string, string[]>
    }) => {
      defaultCmd = options.cmd
      defaultCmdOptionsMap = options.cmdOptionsMap
    }
    const setupCmd = (cmd: string) => (defaultCmd = cmd)
    const setupCmdOptionsMap = (cmdOptionsMap: Record<string, string[]>) => (defaultCmdOptionsMap = cmdOptionsMap)
    const setupCmdOptions = (options: string[], cmd = defaultCmd) => defaultCmdOptionsMap[cmd] = options
    const ctx = {
      root,
      async exec(t: TestContext, {
        cmd = defaultCmd,
        moreOptions = [],
        overrideOptions = [],
        autoSnapDist = true,
        remove = true
      }: CtxExecOptions = {}) {
        // noinspection JSMismatchedCollectionQueryUpdate
        const cmdWithOptions = [cmd]
        if (overrideOptions.length === 0) {
          const options = defaultCmdOptionsMap[cmd]
          if (options != null) {
            cmdWithOptions.push(...options)
          }
          cmdWithOptions.push(...moreOptions)
        } else {
          cmdWithOptions.push(...overrideOptions)
        }
        await execWithRoot(root, cmdWithOptions.join(' '))
        // noinspection PointlessBooleanExpressionJS
        if (autoSnapDist !== false) {
          // noinspection PointlessBooleanExpressionJS
          snapshotDir(t, path.resolve(root, autoSnapDist === true ? 'dist' : autoSnapDist), remove)
        }
      }
    }
    const test = (title: string, func: (context: Ctx & TestContext) => any) => {
      vitestTest.concurrent(title, async t => {
        await func(Object.assign({}, {
          ...ctx,
          exec: ctx.exec.bind(ctx, t)
        }, t))
      })
    }
    return {
      test,
      dflt: async ({ exec }: Ctx & TestContext) => exec(),
      setup,
      setupCmd,
      setupCmdOptionsMap,
      setupCmdOptions
    }
  }
}

export function createDescribe(options: CreateUseExecOptions) {
  const useExec = createUseExec(options)
  const describe = (
    title: string,
    func: (ctx: ReturnType<typeof useExec>) => any
  ) =>
    vitestDescribe(title, () => {
      func(useExec(title.replaceAll(' ', '-')))
    })
  return {
    describe,
    dflt: ({ test, dflt }: ReturnType<typeof useExec>) => test('common', dflt)
  }
}
