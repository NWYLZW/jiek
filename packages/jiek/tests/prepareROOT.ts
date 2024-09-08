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
    const args = [
      'pnpm i',
      notWorkspace ? '--ignore-workspace' : null
    ].filter(Boolean).join(' ')
    childProcess.execSync(args, {
      cwd: ROOT,
      stdio: 'inherit'
    })
  })
  afterAll(() => {
    fs.rmSync(path.resolve(ROOT, 'node_modules'), { recursive: true })
  })
  return [ROOT, [...commonPrefixes, command, '--root', ROOT]] as [string, string[]]
}
