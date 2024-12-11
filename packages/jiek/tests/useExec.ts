import { exec, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type { TaskContext, Test, TestContext } from 'vitest'
import { afterAll, beforeAll, describe as vitestDescribe, test as vitestTest } from 'vitest'

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

type CustomTestContext = Ctx & TaskContext<Test> & TestContext

const resolveByFixtures = (...paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

async function snapshotDir(
  { root, expect }: CustomTestContext,
  dir: string,
  {
    tag,
    title,
    remove = true
  }: {
    tag: string
    title: string
    remove?: boolean
  }
) {
  const files = fs.readdirSync(dir, { recursive: true })
  expect(files).toMatchSnapshot()
  const resolveBySnapshotDir = (...paths: string[]) =>
    path.resolve(
      __dirname,
      '__snapshots__',
      tag,
      title,
      (path.relative(root, dir)).replaceAll('/', '__'),
      ...paths
    )
  const tasks = files.map(async (file) => {
    if (typeof file !== 'string') return
    if (fs.statSync(path.resolve(dir, file)).isDirectory()) return
    await expect(
      fs.readFileSync(path.resolve(dir, file), 'utf-8')
    ).toMatchFileSnapshot(resolveBySnapshotDir(file))
  })
  await Promise.all(tasks)
  if (remove) {
    void fs.promises.rm(dir, { recursive: true })
  }
}

async function execWithRoot(root: string, cmd: string) {
  const cliBinPath = path.resolve(__dirname, '../bin/jiek.js')
  const args = ['node', cliBinPath, cmd].join(' ')
  const {
    npm_lifecycle_event: NPM_LIFECYCLE_EVENT
  } = process.env
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (NPM_LIFECYCLE_EVENT != null) {
    // remove all npm environment variables
    for (const key in env) if (key.startsWith('npm_')) delete env[key]
    for (const key in env) if (key.startsWith('JIEK_')) delete env[key]
  }
  env.JIEK_ROOT = root
  const p = exec(args, {
    cwd: root,
    env
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
        if (stdout.trim() !== '') {
          console.log(stdout)
        }
        resolve()
      } else {
        reject(new Error(`exit code: ${code}\n${stdout}\n${stderr}`))
      }
    })
  })
}

type CreateUseExecOptions =
  & {
    base?: string
    cmdOptions?: string[]
    cmdOptionsMap?: Record<string, string[]>
  }
  & (
    | {
      snapshotTag?: string
      cmd: string
    }
    | {
      snapshotTag: string
      cmd?: undefined
    }
  )

function createUseExec(options: CreateUseExecOptions) {
  const snapshotTag = options.snapshotTag ?? options.cmd ?? 'default'
  return function useExec(title: string, noHook = false) {
    const root = (options.base != null)
      ? resolveByFixtures(options.base, title)
      : resolveByFixtures(title)

    const resolveByRoot = (...paths: string[]) => path.resolve(root, ...paths)
    const notWorkspace = !fs.existsSync(resolveByRoot('pnpm-workspace.yaml'))

    const before = async () => {
      const args = [
        'pnpm i',
        notWorkspace ? '--ignore-workspace' : null
      ].filter(Boolean).join(' ')
      execSync(args, {
        cwd: root,
        stdio: ['ignore', 'ignore', 'inherit']
      })
    }
    const after = async () => {
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
    }
    if (!noHook) {
      beforeAll(before)
      afterAll(after)
    }

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

    const ctxExec = async (
      t: CustomTestContext,
      {
        cmd = defaultCmd,
        moreOptions = [],
        overrideOptions = [],
        autoSnapDist = true,
        remove = true
      }: CtxExecOptions = {}
    ) => {
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
        await snapshotDir(
          t,
          path.resolve(root, autoSnapDist === true ? 'dist' : autoSnapDist),
          {
            tag: snapshotTag,
            title,
            remove
          }
        )
      }
    }
    const test = (title: string, func: (context: CustomTestContext) => any, timeout?: number) =>
      vitestTest.concurrent(title, async t => {
        noHook && await before()
        const ctx: CustomTestContext = {
          root,
          ...t,
          // expect is not enumerable, so we need to assign it manually
          expect: t.expect,
          async exec(...args) {
            return ctxExec(ctx, ...args)
          }
        }
        await func(ctx)
        noHook && await after()
      }, timeout)
    return {
      test,
      dflt: async ({ exec }: CustomTestContext) => exec(),
      setup,
      setupCmd,
      setupCmdOptionsMap,
      setupCmdOptions
    }
  }
}

type UseExecRT = ReturnType<ReturnType<typeof createUseExec>>

type ExecDescribe = (
  title: string,
  func: (ctx: UseExecRT) => any,
  noExec?: undefined | false
) => void
type NoExecDescribe = (
  title: string,
  func: (ctx: {
    test: (title: string, func: (context: CustomTestContext) => unknown, timeout?: number) => void
  }) => any,
  noExec: true
) => void

type UserDescribe =
  & ExecDescribe
  & NoExecDescribe

export function createDescribe(options: CreateUseExecOptions) {
  const useExec = createUseExec(options)
  const describe: UserDescribe = (title, func, noExec = false) =>
    vitestDescribe(title, () => {
      if (noExec) {
        ;(func as Parameters<NoExecDescribe>[1])({
          test(title, f, timeout) {
            useExec(
              title.replaceAll(' ', '-'),
              true
            ).test(title, ctx => f(ctx), timeout)
          }
        })
      } else {
        func(useExec(title.replaceAll(' ', '-')))
      }
    })
  return {
    describe
  }
}
