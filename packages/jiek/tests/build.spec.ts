import '../src/commands/build'

import fs from 'node:fs'
import path from 'node:path'

import * as childProcess from 'child_process'
import { program } from 'commander'
import { afterAll, beforeAll, describe, test } from 'vitest'

import { actionFuture } from '../src/inner'

const ROOT = path.resolve(__dirname, 'fixtures')

beforeAll(() => {
  childProcess.execSync('pnpm i', {
    cwd: ROOT,
    stdio: 'inherit'
  })
})
afterAll(() => {
  fs.unlinkSync(path.resolve(ROOT, 'node_modules'))
})

const prefixes = ['node', 'jiek', 'build', '--root', ROOT]
describe('build', () => {
  test('base', () => {
    process.env.WORKSPACE_DIR = ROOT
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    return actionFuture
  })
})
