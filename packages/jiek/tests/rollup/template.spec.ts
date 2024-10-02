import { template } from 'jiek/rollup.v2'
import { describe, expect, test } from 'vitest'

describe('rollup - template', () => {
  test('base', () => {
    expect(template({
      name: 'foo',
      exports: './src/index.ts'
    })).toMatchSnapshot()
    expect(template({
      type: 'module',
      name: 'foo',
      exports: './src/index.ts'
    })).toMatchSnapshot()
  })
  test('with package.json and *.d.ts export files and should skip it', () => {
    expect(template({
      name: 'foo',
      exports: {
        './package.json': './package.json'
      }
    })).toMatchSnapshot()
    expect(template({
      name: 'foo',
      exports: {
        './package.json': './package.json',
        '.': './src/index.ts'
      }
    })).toMatchSnapshot()
    expect(template({
      name: 'foo',
      exports: {
        './package.json': './package.json',
        '.': './src/index.ts',
        './foo': './src/foo.d.ts'
      }
    })).toMatchSnapshot()
  })
  test('with import or require conditional', () => {
    expect(template({
      name: 'foo',
      exports: {
        '.': {
          import: './src/index.mts',
          default: './src/index.ts'
        }
      }
    })).toMatchSnapshot()
    expect(template({
      type: 'module',
      name: 'foo',
      exports: {
        '.': {
          require: './src/index.cts',
          default: './src/index.ts'
        }
      }
    })).toMatchSnapshot()
  })
})
