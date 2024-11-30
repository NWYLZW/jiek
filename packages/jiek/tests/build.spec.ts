import { createDescribe } from './useExec.ts'

const describe = createDescribe({ cmd: 'build', cmdOptions: ['-s'] })

describe('simple', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('simple mjs', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('require in mjs', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('only minify', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('export self subpath', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('multiple exports', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('glob exports', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('resolve imports', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('unordered exports inputs', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('with no resolve exports', ({ test }) => {
  test('common', ({ exec }) => exec())
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
describe('not dts tsconfig', ({ test }) => {
  test('common', ({ exec }) => exec())
})
describe('with scss file import', ({ test }) => {
  test('common', ({ exec }) => exec())
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
describe('import type from subpath', ({ test }) => {
  test('common', ({ exec }) => exec())
})
