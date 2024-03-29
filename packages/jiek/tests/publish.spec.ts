import '../src/commands/publish'

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
  childProcess.execSync('pnpm i', {
    cwd: ROOT,
    stdio: 'inherit'
  })
})

const prefixes = ['node', 'jiek', 'publish', '--root', ROOT]
describe('publish', () => {
  test('base', () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    return actionFuture
  })
})
