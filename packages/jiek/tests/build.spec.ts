import '../src/commands/base'
import '../src/commands/build'

import fs from 'node:fs'
import path from 'node:path'

import * as childProcess from 'child_process'
import { program } from 'commander'
import { afterAll, beforeAll, describe, test } from 'vitest'

import { actionFuture } from '../src/inner'

const commonPrefixes = ['node', 'jiek', 'build']

const getROOT = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

function prepareROOT(paths: string[]) {
  const ROOT = getROOT(paths)
  beforeAll(() => {
    childProcess.execSync('pnpm i', {
      cwd: ROOT,
      stdio: 'inherit'
    })
  })
  afterAll(() => {
    fs.rmSync(path.resolve(ROOT, 'node_modules'), { recursive: true })
  })
  return [ROOT, [...commonPrefixes, '--root', ROOT]]
}

describe('base', () => {
  const [, prefixes] = prepareROOT(['base'])
  test('common', () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    return actionFuture
  })
})
