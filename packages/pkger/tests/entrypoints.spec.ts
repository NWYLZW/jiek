import { describe, expect, test } from 'vitest'

import { entrypoints2Exports } from '../src/entrypoints'

describe('entrypoints2Exports', () => {
  test('single file', () => {
    expect(entrypoints2Exports('src/index.ts')).toStrictEqual({
      '.': 'dist/index.js'
    })
    expect(entrypoints2Exports('src/foo.ts')).toStrictEqual({
      '.': 'dist/foo.js'
    })
  })
  test('multiple files array', () => {
    expect(entrypoints2Exports([
      'src/index.ts'
    ])).toStrictEqual({
      '.': 'dist/index.js'
    })
    expect(entrypoints2Exports([
      'src/index.ts',
      'src/foo.ts'
    ])).toStrictEqual({
      '.': 'dist/index.js',
      './foo': 'dist/foo.js'
    })
  })
  test('multiple files object', () => {
    expect(entrypoints2Exports({
      '.': 'src/index.ts'
    })).toStrictEqual({
      '.': 'dist/index.js'
    })
    expect(entrypoints2Exports({
      './foo': 'src/foo.ts'
    })).toStrictEqual({
      './foo': 'dist/foo.js'
    })
    expect(entrypoints2Exports({
      '.': 'src/index.ts',
      './foo': 'src/foo.ts'
    })).toStrictEqual({
      '.': 'dist/index.js',
      './foo': 'dist/foo.js'
    })
  })
  test('nested conditional', () => {
    expect(entrypoints2Exports({
      '.': {
        styless: 'src/index.ts',
        browser: 'src/index.ts',
        default: 'src/index.ts'
      }
    })).toStrictEqual({
      '.': {
        styless: 'dist/index.js',
        browser: 'dist/index.js',
        default: 'dist/index.js'
      }
    })
  })
  test('special common or module entry', () => {
    expect(entrypoints2Exports('src/index.cts')).toStrictEqual({
      '.': { require: 'dist/index.cjs' }
    })
    expect(entrypoints2Exports('src/index.mts')).toStrictEqual({
      '.': { import: 'dist/index.mjs' }
    })
    expect(entrypoints2Exports(['src/index.cts'])).toStrictEqual({
      '.': { require: 'dist/index.cjs' }
    })
    expect(entrypoints2Exports(['src/index.mts'])).toStrictEqual({
      '.': { import: 'dist/index.mjs' }
    })
    expect(entrypoints2Exports({
      '.': 'src/index.cts'
    })).toStrictEqual({
      '.': { require: 'dist/index.cjs' }
    })
    expect(entrypoints2Exports({
      '.': 'src/index.mts'
    })).toStrictEqual({
      '.': { import: 'dist/index.mjs' }
    })
  })
  test('with source', () => {
    expect(entrypoints2Exports('src/index.ts', { withSource: true })).toStrictEqual({
      '.': {
        source: 'src/index.ts',
        default: 'dist/index.js'
      }
    })
    expect(entrypoints2Exports(['src/index.ts'], { withSource: true })).toStrictEqual({
      '.': {
        source: 'src/index.ts',
        default: 'dist/index.js'
      }
    })
    expect(entrypoints2Exports({
      '.': 'src/index.ts'
    }, {
      withSource: true
    })).toStrictEqual({
      '.': {
        source: 'src/index.ts',
        default: 'dist/index.js'
      }
    })
    expect(entrypoints2Exports({
      '.': 'src/index.cts'
    }, {
      withSource: true
    })).toStrictEqual({
      '.': {
        source: 'src/index.cts',
        require: 'dist/index.cjs'
      }
    })
  })
})
