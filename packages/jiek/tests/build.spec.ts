import { createDescribe } from './useExec.ts'

const { describe, dflt } = createDescribe({ cmd: 'build', cmdOptions: ['-s'] })

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
describe('monorepo', ({ test }) => {
  test('build foo', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-foo'],
      autoSnapDist: 'packages/foo/dist'
    }))
  test('build bar', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-bar'],
      autoSnapDist: 'packages/bar/dist'
    }))
})
describe('with scss file import', ctx => dflt(ctx))
describe('project references', ({ test }) => {
  test('build foo', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-foo'],
      autoSnapDist: 'packages/foo/dist'
    }))
  test('build fuo', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-fuo'],
      autoSnapDist: 'packages/fuo/dist'
    }))
  test('build fuu', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-fuu'],
      autoSnapDist: 'packages/fuu/dist'
    }))
  test('build bar', ({ exec }) =>
    void exec({
      moreOptions: ['-f', '@jiek/test-monorepo-bar'],
      autoSnapDist: 'packages/bar/dist'
    }))
})
describe('root package', ({ test }) => {
  test('common', ({ exec }) =>
    void exec({
      moreOptions: ['-f', 'root-package']
    }))
})
describe('import type from subpath', ctx => dflt(ctx))
