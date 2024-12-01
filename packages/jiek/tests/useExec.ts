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

interface CreateUseExecOptions {
  snapshotTag: string
  cmd?: string
  cmdOptions?: string[]
  cmdOptionsMap?: Record<string, string[]>
}

function createUseExec(options: CreateUseExecOptions) {
  return function useExec(title: string) {
    const root = resolveByFixtures(title)

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
    beforeAll(before)
    afterAll(after)

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
            tag: options.snapshotTag,
            title,
            remove
          }
        )
      }
    }
    const test = (title: string, func: (context: CustomTestContext) => any) =>
      vitestTest.concurrent(title, async t => {
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
      })
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

interface UserDescribe {
  (
    title: string,
    func: (ctx: ReturnType<ReturnType<typeof createUseExec>>) => any,
    notExec?: undefined | false
  ): void
  (
    title: string,
    func: () => any,
    notExec: true
  ): void
}
export function createDescribe(options: CreateUseExecOptions) {
  const useExec = createUseExec(options)
  const describe: UserDescribe = (title, func, notExec = false) =>
    vitestDescribe(title, () => {
      func(
        // @ts-expect-error
        notExec ? undefined : useExec(title.replaceAll(' ', '-'))
      )
    })
  return {
    describe,
    dflt: ({ test, dflt }: ReturnType<typeof useExec>) => test('common', dflt)
  }
}
