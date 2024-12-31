import { createDescribe } from './useExec.ts'

const { describe } = createDescribe({
  cmd: 'build',
  cmdOptions: ['-s']
})

describe('no mono', ({ test }) => {
  const titles = [
    'simple',
    'simple js',
    'simple mjs',
    'simple cts',
    'require in mjs',
    'import attributes',
    'injects',
    'only minify',
    'export self subpath',
    'multiple exports',
    'glob exports',
    'resolve imports',
    'unordered exports inputs',
    'with no resolve exports',
    'with scss file import',
    'import type from subpath',
    'import type from external',
    'import with external'
  ].filter((t, _, arr) =>
    ([
      ...arr
      // 'resolve imports'
    ] as string[]).includes(t)
  )
  titles.forEach(title => test(title, async ({ exec }) => exec()))
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
