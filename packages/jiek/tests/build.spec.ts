import { createDescribe } from './useExec.ts'

const { describe, dflt } = createDescribe({
  snapshotTag: 'build',
  cmd: 'build',
  cmdOptions: ['-s']
})

describe('no mono', () => {
  describe('simple', ctx => dflt(ctx))
  describe('simple mjs', ctx => dflt(ctx))
  describe('require in mjs', ctx => dflt(ctx))
  describe('only minify', ctx => dflt(ctx))
  describe('export self subpath', ctx => dflt(ctx))
  describe('multiple exports', ctx => dflt(ctx))
  describe('glob exports', ctx => dflt(ctx))
  describe('resolve imports', ctx => dflt(ctx))
  describe('unordered exports inputs', ctx => dflt(ctx))
  describe('with no resolve exports', ctx => dflt(ctx))
  describe('with scss file import', ctx => dflt(ctx))
  describe('import type from subpath', ctx => dflt(ctx))
}, true)
describe('mono', () => {
  describe('monorepo', ({ test }) => {
    test('build foo', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-foo'],
        autoSnapDist: 'packages/foo/dist'
      }))
    test('build bar', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-bar'],
        autoSnapDist: 'packages/bar/dist'
      }))
  })
  describe('project references', ({ test }) => {
    test('build foo', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-foo'],
        autoSnapDist: 'packages/foo/dist'
      }))
    test('build fuo', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-fuo'],
        autoSnapDist: 'packages/fuo/dist'
      }))
    test('build fuu', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-fuu'],
        autoSnapDist: 'packages/fuu/dist'
      }))
    test('build bar', async ({ exec }) =>
      exec({
        moreOptions: ['-f', '@jiek/test-monorepo-bar'],
        autoSnapDist: 'packages/bar/dist'
      }))
  })
  describe('root package', ({ test }) => {
    test('common', async ({ exec }) =>
      exec({
        moreOptions: ['-f', 'root-package']
      }))
  })
}, true)
