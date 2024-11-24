import childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { prepareROOT } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'build -s')

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

function runCommandAndSnapshotDistFiles(cmd: string, root: string, prefixes: string[], distPath = 'dist') {
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

describe('simple', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['simple'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('simple mjs', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['simple-mjs'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('only minify', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['only-minify'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('export self subpath', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['export-self-subpath'])
  test(
    'common',
    runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist')
  )
})
describe('multiple exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['multiple-exports'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('glob exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['glob-exports'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('resolve imports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['resolve-imports'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('unordered exports inputs', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['unordered-exports_input'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('with no resolve exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['with-no-resolve-export'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('monorepo', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['monorepo'])
  test(
    'build foo',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-foo',
      root,
      prefixes,
      'packages/foo/dist'
    )
  )
  test(
    'build bar',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-bar',
      root,
      prefixes,
      'packages/bar/dist'
    )
  )
})
describe('not dts tsconfig', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['not-dts-tsconfig'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('with scss file import', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['with-scss-file-import'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('project references', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['project-references'])
  test(
    'build foo',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-foo',
      root,
      prefixes,
      'packages/foo/dist'
    )
  )
  test(
    'build fuo',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-fuo',
      root,
      prefixes,
      'packages/fuo/dist'
    )
  )
  test(
    'build fuu',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-fuu',
      root,
      prefixes,
      'packages/fuu/dist'
    )
  )
  test(
    'build bar',
    runCommandAndSnapshotDistFiles.bind(
      null,
      '-f @jiek/test-monorepo-bar',
      root,
      prefixes,
      'packages/bar/dist'
    )
  )
})
describe('root-package', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['root-package'])
  test('common', runCommandAndSnapshotDistFiles.bind(null, '-f root-package', root, prefixes, 'dist'))
})
describe('import-type-from-subpath', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['import-type-from-subpath'], {
    notWorkspace: true
  })
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
