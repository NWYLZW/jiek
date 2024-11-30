import { describe } from 'vitest'

import { createUseExec } from './useExec.ts'

const useExec = createUseExec({ cmd: 'build', cmdOptions: ['-s'] })

describe('simple', () => {
  const { test } = useExec('simple')
  test('common', ({ exec }) => exec())
})
describe('simple mjs', () => {
  const { test } = useExec('simple-mjs')
  test('common', ({ exec }) => exec())
})
describe('require in mjs', () => {
  const { test } = useExec('require-in-mjs')
  test('common', ({ exec }) => exec())
})
describe('only minify', () => {
  const { test } = useExec('only-minify')
  test('common', ({ exec }) => exec())
})
describe('export self subpath', () => {
  const { test } = useExec('export-self-subpath')
  test('common', ({ exec }) => exec())
})
describe('multiple exports', () => {
  const { test } = useExec('multiple-exports')
  test('common', ({ exec }) => exec())
})
describe('glob exports', () => {
  const { test } = useExec('glob-exports')
  test('common', ({ exec }) => exec())
})
describe('resolve imports', () => {
  const { test } = useExec('resolve-imports')
  test('common', ({ exec }) => exec())
})
describe('unordered exports inputs', () => {
  const { test } = useExec('unordered-exports_input')
  test('common', ({ exec }) => exec())
})
describe('with no resolve exports', () => {
  const { test } = useExec('with-no-resolve-export')
  test('common', ({ exec }) => exec())
})
describe('monorepo', () => {
  const { test } = useExec('monorepo')
  test('build foo', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-foo'],
      autoSnapDist: 'packages/foo/dist'
    }))
  test('build bar', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-bar'],
      autoSnapDist: 'packages/bar/dist'
    }))
})
describe('not dts tsconfig', () => {
  const { test } = useExec('not-dts-tsconfig')
  test('common', ({ exec }) => exec())
})
describe('with scss file import', () => {
  const { test } = useExec('with-scss-file-import')
  test('common', ({ exec }) => exec())
})
describe('project references', () => {
  const { test } = useExec('project-references')
  test('build foo', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-foo'],
      autoSnapDist: 'packages/foo/dist'
    }))
  test('build fuo', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-fuo'],
      autoSnapDist: 'packages/fuo/dist'
    }))
  test('build fuu', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-fuu'],
      autoSnapDist: 'packages/fuu/dist'
    }))
  test('build bar', ({ exec }) =>
    exec({
      moreOptions: ['-f', '@jiek/test-monorepo-bar'],
      autoSnapDist: 'packages/bar/dist'
    }))
})
describe('root package', () => {
  const { test } = useExec('root-package')
  test('common', ({ exec }) =>
    exec({
      moreOptions: ['-f', 'root-package']
    }))
})
describe('import type from subpath', () => {
  const { test } = useExec('import-type-from-subpath')
  test('common', ({ exec }) => exec())
})
