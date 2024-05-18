import '../src/commands/base'
import '../src/commands/publish'

import fs from 'node:fs'
import path from 'node:path'

import * as childProcess from 'child_process'
import { program } from 'commander'
import { afterAll, beforeAll, describe, test } from 'vitest'

import { actionFuture } from '../src/inner'

const ROOT = path.resolve(__dirname, 'fixtures/base')

beforeAll(() => {
  childProcess.execSync('pnpm i', {
    cwd: ROOT,
    stdio: 'inherit'
  })
})
afterAll(() => {
  fs.rmSync(path.resolve(ROOT, 'node_modules'), { recursive: true })
})

const prefixes = ['node', 'jiek', '--root', ROOT, 'publish']
describe('publish', () => {
  test('base', () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    return actionFuture
  })
})
