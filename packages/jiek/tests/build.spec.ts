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

function prepareROOT(
  paths: string[], {
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
  return [ROOT, [...commonPrefixes, '--root', ROOT]] as [string, string[]]
}

function snapshotDistFiles(distDir: string) {
  const files = fs.readdirSync(distDir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    expect(`${file}:\n${
      fs.readFileSync(path.resolve(distDir, file), 'utf-8')
    }`).toMatchSnapshot()
  })
  fs.rmSync(distDir, { recursive: true })
}

describe('base', () => {
  const [root, prefixes] = prepareROOT(['base'])
  test('common', async () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'packages/foo/dist'))
  })
})
describe('single package and single entry', () => {
  const [root, prefixes] = prepareROOT(['single-package-and-single-entry'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
describe('single package and multiple entries', () => {
  const [root, prefixes] = prepareROOT(['single-package-and-multiple-entries'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
describe('with no resolve exports', () => {
  const [root, prefixes] = prepareROOT(['with-no-resolve-export'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
