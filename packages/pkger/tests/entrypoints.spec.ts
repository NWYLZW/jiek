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
})
