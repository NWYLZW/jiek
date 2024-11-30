import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { afterAll, beforeAll, expect, test as vitestTest } from 'vitest'

const resolveByFixtures = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

function snapshotDir(dir: string, remove = true) {
  const files = fs.readdirSync(dir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    if (fs.statSync(path.resolve(dir, file)).isDirectory()) return
    expect(`${file}:\n${fs.readFileSync(path.resolve(dir, file), 'utf-8')}`).toMatchSnapshot()
  })
  if (remove) {
    fs.rmSync(dir, { recursive: true })
  }
}

function execWithRoot(root: string, cmd: string) {
  const cliBinPath = path.resolve(__dirname, '../bin/jiek.js')
  const args = ['node', cliBinPath, cmd].join(' ')
  childProcess.execSync(args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      JIEK_ROOT: root
    }
  })
}

interface Ctx {
  root: string
  exec: (options?: {
    cmd?: string
    moreOptions?: string[]
    overrideOptions?: string[]
    autoSnapDist?: boolean | string
    remove?: boolean
  }) => Ctx
  snap: (target: string, remove: boolean) => Ctx
}

export function createUseExec(options: {
  cmd?: string
  cmdOptions?: string[]
  cmdOptionsMap?: Record<string, string[]>
}) {
  return function useExec(...paths: string[]) {
    const root = resolveByFixtures(paths)
    const resolveByRoot = (...paths: string[]) => path.resolve(root, ...paths)
    const notWorkspace = !fs.existsSync(path.resolve(root, 'pnpm-workspace.yaml'))
    beforeAll(() => {
      const args = [
        'pnpm i',
        notWorkspace ? '--ignore-workspace' : null
      ].filter(Boolean).join(' ')
      childProcess.execSync(args, {
        cwd: root,
        stdio: ['ignore', 'ignore', 'inherit']
      })
    })
    afterAll(() => {
      fs.rmSync(resolveByRoot('node_modules'), { recursive: true })

      const packagesPath = path.resolve(root, 'packages')
      if (!fs.existsSync(packagesPath)) return
      if (!fs.statSync(packagesPath).isDirectory()) return

      fs.readdirSync(packagesPath)
        .forEach(pkg => {
          if (typeof pkg !== 'string') return
          const nodeModulesPath = resolveByRoot('packages', pkg, 'node_modules')
          if (!fs.existsSync(nodeModulesPath)) return
          if (!fs.statSync(nodeModulesPath).isDirectory()) return
          fs.rmSync(nodeModulesPath, { recursive: true })
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
    const ctx: Ctx = {
      root,
      exec({
        cmd = defaultCmd,
        moreOptions = [],
        overrideOptions = [],
        autoSnapDist = true,
        remove = true
      } = {}) {
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
        execWithRoot(root, cmdWithOptions.join(' '))
        // noinspection PointlessBooleanExpressionJS
        if (autoSnapDist !== false) {
          // noinspection PointlessBooleanExpressionJS
          ctx.snap(autoSnapDist === true ? 'dist' : autoSnapDist, remove)
        }
        return this
      },
      snap(target = 'dist', remove = true) {
        snapshotDir(path.resolve(root, target), remove)
        return this
      }
    }
    const test = (title: string, func: (context: Ctx) => any) => {
      vitestTest(title, async () => {
        await func(ctx)
      })
    }
    return {
      test,
      setup,
      setupCmd,
      setupCmdOptionsMap,
      setupCmdOptions
    }
  }
}
