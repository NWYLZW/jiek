import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { afterAll, beforeAll, expect } from 'vitest'

const getROOT = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

function snapshotDistFiles(distDir: string) {
  const files = fs.readdirSync(distDir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    if (fs.statSync(path.resolve(distDir, file)).isDirectory()) return
    expect(`${file}:\n${fs.readFileSync(path.resolve(distDir, file), 'utf-8')}`).toMatchSnapshot()
  })
  fs.rmSync(distDir, { recursive: true })
}

export function runCommandAndSnapshotDistFiles(cmd: string, root: string, prefixes: string[], distPath = 'dist') {
  const cliBinPath = path.resolve(__dirname, '../bin/jiek.js')
  const args = ['node', cliBinPath, ...prefixes, cmd].join(' ')
  childProcess.execSync(args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      JIEK_ROOT: root
    }
  })
  snapshotDistFiles(path.resolve(root, distPath))
}

export function prepareROOT(
  command: string,
  ...paths: string[]
) {
  const ROOT = getROOT(paths)
  const notWorkspace = !fs.existsSync(path.resolve(ROOT, 'pnpm-workspace.yaml'))
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
  return [ROOT, [command]] as [string, string[]]
}
