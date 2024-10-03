import childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { prepareROOT } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'build')

function snapshotDistFiles(distDir: string) {
  const files = fs.readdirSync(distDir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    expect(`${file}:\n${fs.readFileSync(path.resolve(distDir, file), 'utf-8')}`).toMatchSnapshot()
  })
  fs.rmSync(distDir, { recursive: true })
}

function runCommandAndSnapshotDistFiles(cmd: string, root: string, prefixes: string[], distPath = 'dist') {
  const cliBinPath = path.resolve(__dirname, '../bin/jiek.js')
  const args = ['node', cliBinPath, cmd, ...prefixes].join(' ')
  childProcess.execSync(args, { cwd: root, stdio: 'inherit' })
  snapshotDistFiles(path.resolve(root, distPath))
}

describe('simple', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-simple'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, 'build', root, prefixes, 'dist'))
})
describe('simple mjs', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-simple-mjs'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, 'build', root, prefixes, 'dist'))
})
describe('multiple exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-multiple-exports'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, 'build', root, prefixes, 'dist'))
})
describe('unordered exports inputs', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-unordered-exports_input'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, 'build', root, prefixes, 'dist'))
})
describe('with no resolve exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-with-no-resolve-export'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, 'build', root, prefixes, 'dist'))
})
describe('monorepo', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['v2-monorepo'])
  test(
    'build foo',
    runCommandAndSnapshotDistFiles.bind(null, 'build -f @jiek/test-monorepo-foo', root, prefixes, 'packages/foo/dist')
  )
  test(
    'build bar',
    runCommandAndSnapshotDistFiles.bind(null, 'build -f @jiek/test-monorepo-bar', root, prefixes, 'packages/bar/dist')
  )
})
