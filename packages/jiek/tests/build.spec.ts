import { describe, test } from 'vitest'

import { prepareROOT, runCommandAndSnapshotDistFiles } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'build -s')

describe('simple', () => {
  const [root, prefixes] = prepareRootWithSubCmd('simple')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('simple mjs', () => {
  const [root, prefixes] = prepareRootWithSubCmd('simple-mjs')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('only minify', () => {
  const [root, prefixes] = prepareRootWithSubCmd('only-minify')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('export self subpath', () => {
  const [root, prefixes] = prepareRootWithSubCmd('export-self-subpath')
  test(
    'common',
    runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist')
  )
})
describe('multiple exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd('multiple-exports')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('glob exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd('glob-exports')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('resolve imports', () => {
  const [root, prefixes] = prepareRootWithSubCmd('resolve-imports')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('unordered exports inputs', () => {
  const [root, prefixes] = prepareRootWithSubCmd('unordered-exports_input')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('with no resolve exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd('with-no-resolve-export')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('monorepo', () => {
  const [root, prefixes] = prepareRootWithSubCmd('monorepo')
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
  const [root, prefixes] = prepareRootWithSubCmd('not-dts-tsconfig')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('with scss file import', () => {
  const [root, prefixes] = prepareRootWithSubCmd('with-scss-file-import')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
describe('project references', () => {
  const [root, prefixes] = prepareRootWithSubCmd('project-references')
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
  const [root, prefixes] = prepareRootWithSubCmd('root-package')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '-f root-package', root, prefixes, 'dist'))
})
describe('import-type-from-subpath', () => {
  const [root, prefixes] = prepareRootWithSubCmd('import-type-from-subpath')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
