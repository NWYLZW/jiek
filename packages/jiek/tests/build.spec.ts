import { createDescribe } from './useExec.ts'

const describe = createDescribe({ cmd: 'build', cmdOptions: ['-s'] })

describe('simple', ({ test, dflt }) => {
  test('common', dflt)
})
describe('simple mjs', ({ test, dflt }) => {
  test('common', dflt)
})
describe('require in mjs', ({ test, dflt }) => {
  test('common', dflt)
})
describe('only minify', ({ test, dflt }) => {
  test('common', dflt)
})
describe('export self subpath', ({ test, dflt }) => {
  test('common', dflt)
})
describe('multiple exports', ({ test, dflt }) => {
  test('common', dflt)
})
describe('glob exports', ({ test, dflt }) => {
  test('common', dflt)
})
describe('resolve imports', ({ test, dflt }) => {
  test('common', dflt)
})
describe('unordered exports inputs', ({ test, dflt }) => {
  test('common', dflt)
})
describe('with no resolve exports', ({ test, dflt }) => {
  test('common', dflt)
})
describe('monorepo', ({ test }) => {
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
describe('not dts tsconfig', ({ test, dflt }) => {
  test('common', dflt)
})
describe('with scss file import', ({ test, dflt }) => {
  test('common', dflt)
})
describe('project references', ({ test }) => {
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
describe('root package', ({ test }) => {
  test('common', ({ exec }) =>
    exec({
      moreOptions: ['-f', 'root-package']
    }))
})
describe('import type from subpath', ({ test, dflt }) => {
  test('common', dflt)
})
