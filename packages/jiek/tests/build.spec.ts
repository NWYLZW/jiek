import '../src/commands/base'
import '../src/commands/build'

import fs from 'node:fs'
import path from 'node:path'

import * as childProcess from 'child_process'
import { program } from 'commander'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { actionFuture } from '../src/inner'

const commonPrefixes = ['node', 'jiek', 'build']

const getROOT = (paths: string[]) => path.resolve(__dirname, 'fixtures', ...paths)

function prepareROOT(paths: string[]) {
  const ROOT = getROOT(paths)
  beforeAll(() => {
    childProcess.execSync('pnpm i --no-lock', {
      cwd: ROOT,
      stdio: 'inherit'
    })
  })
  afterAll(() => {
    fs.rmSync(path.resolve(ROOT, 'node_modules'), { recursive: true })
  })
  return [ROOT, [...commonPrefixes, '--root', ROOT]] as [string, string[]]
}

describe('base', () => {
  const [root, prefixes] = prepareROOT(['base'])
  test('common', async () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    await actionFuture
    const distDir = path.resolve(root, 'packages/foo/dist')
    // expect the root/foo/dist to be created
    expect(fs.existsSync(distDir)).toBeTruthy()
    // snapshot the root/foo/dist files content
    const files = fs.readdirSync(distDir, { recursive: true })
    files.forEach((file) => {
      if (typeof file !== 'string') return
      expect(`${file}:\n${
        fs.readFileSync(path.resolve(distDir, file), 'utf-8')
      }`).toMatchSnapshot()
    })
    fs.rmSync(distDir, { recursive: true })
  })
})
