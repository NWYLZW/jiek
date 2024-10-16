import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll } from 'vitest'

const commonPrefixes = ['node', 'jiek']

const getROOT = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

export function prepareROOT(
  command: string,
  paths: string[],
  {
    notWorkspace = false
  }: {
    notWorkspace?: boolean
  } = {}
) {
  const ROOT = getROOT(paths)
  beforeAll(() => {
    fs.mkdirSync(path.resolve(ROOT, 'node_modules/.jiek'), { recursive: true })
    const args = [
      'pnpm i',
      notWorkspace ? '--ignore-workspace' : null
    ].filter(Boolean).join(' ')
    childProcess.execSync(args, {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit']
    })
  })
  afterAll(() => {
    fs.rmSync(path.resolve(ROOT, 'node_modules'), { recursive: true })

    const packagesPath = path.resolve(ROOT, 'packages')
    if (!fs.existsSync(packagesPath)) return
    if (!fs.statSync(packagesPath).isDirectory()) return

    fs.readdirSync(packagesPath)
      .forEach(pkg => {
        if (typeof pkg !== 'string') return
        const nodeModulesPath = path.resolve(ROOT, 'packages', pkg, 'node_modules')
        if (!fs.existsSync(nodeModulesPath)) return
        if (!fs.statSync(nodeModulesPath).isDirectory()) return
        fs.rmSync(nodeModulesPath, { recursive: true })
      })
  })
  return [ROOT, [...commonPrefixes, command, '--root', ROOT]] as [string, string[]]
}
