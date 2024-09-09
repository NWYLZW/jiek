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
