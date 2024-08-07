import { describe, expect, test } from 'vitest'

import { entrypoints2Exports } from '.././src/entrypoints'

describe('entrypoints2Exports', () => {
  test('single file', () => {
    expect(entrypoints2Exports('./src/index.ts')).toStrictEqual({
      '.': './dist/index.js'
    })
    expect(entrypoints2Exports('./src/foo.ts')).toStrictEqual({
      '.': './dist/foo.js'
    })
  })
  test('multiple files array', () => {
    expect(entrypoints2Exports([
      './src/index.ts'
    ])).toStrictEqual({
      '.': './dist/index.js'
    })
    expect(entrypoints2Exports([
      './src/index.ts',
      './src/foo.ts'
    ])).toStrictEqual({
      '.': './dist/index.js',
      './foo': './dist/foo.js'
    })
  })
  test('multiple files object', () => {
    expect(entrypoints2Exports({
      '.': './src/index.ts'
    })).toStrictEqual({
      '.': './dist/index.js'
    })
    expect(entrypoints2Exports({
      './foo': './src/foo.ts'
    })).toStrictEqual({
      './foo': './dist/foo.js'
    })
    expect(entrypoints2Exports({
      '.': './src/index.ts',
      './foo': './src/foo.ts'
    })).toStrictEqual({
      '.': './dist/index.js',
      './foo': './dist/foo.js'
    })
  })
  test('empty', () => {
    expect(entrypoints2Exports([])).toStrictEqual({})
    expect(entrypoints2Exports({})).toStrictEqual({})
  })
  test('nested conditional', () => {
    expect(entrypoints2Exports({
      '.': {
        styless: './src/index.ts',
        browser: './src/index.ts',
        default: './src/index.ts'
      }
    })).toStrictEqual({
      '.': {
        styless: './dist/index.js',
        browser: './dist/index.js',
        default: './dist/index.js'
      }
    })
  })
  test('special common or module entry', () => {
    expect(entrypoints2Exports('./src/index.cts')).toStrictEqual({
      '.': { require: './dist/index.cjs' }
    })
    expect(entrypoints2Exports('./src/index.mts')).toStrictEqual({
      '.': { import: './dist/index.mjs' }
    })
    expect(entrypoints2Exports(['./src/index.cts'])).toStrictEqual({
      '.': { require: './dist/index.cjs' }
    })
    expect(entrypoints2Exports(['./src/index.mts'])).toStrictEqual({
      '.': { import: './dist/index.mjs' }
    })
    expect(entrypoints2Exports({
      '.': './src/index.cts'
    })).toStrictEqual({
      '.': { require: './dist/index.cjs' }
    })
    expect(entrypoints2Exports({
      '.': './src/index.mts'
    })).toStrictEqual({
      '.': { import: './dist/index.mjs' }
    })
  })
  test('with source', () => {
    const exports0 = entrypoints2Exports('./src/index.ts', { withSource: true })
    expect(exports0).toStrictEqual({
      '.': {
        source: './src/index.ts',
        default: './dist/index.js'
      }
    })
    // custom conditional must before default
    expect(Object.keys(exports0['.'] as Record<string, unknown>))
      .toStrictEqual(['source', 'default'])
    expect(entrypoints2Exports('./src/index.cts', { withSource: true })).toStrictEqual({
      '.': {
        require: {
          source: './src/index.cts',
          default: './dist/index.cjs'
        }
      }
    })
    expect(entrypoints2Exports(['./src/index.ts'], { withSource: true })).toStrictEqual({
      '.': {
        source: './src/index.ts',
        default: './dist/index.js'
      }
    })
    expect(entrypoints2Exports([
      './src/index.ts',
      './src/foo.mts'
    ], { withSource: true })).toStrictEqual({
      '.': {
        source: './src/index.ts',
        default: './dist/index.js'
      },
      './foo': {
        import: {
          source: './src/foo.mts',
          default: './dist/foo.mjs'
        }
      }
    })
    expect(entrypoints2Exports({
      '.': './src/index.ts'
    }, {
      withSource: true
    })).toStrictEqual({
      '.': {
        source: './src/index.ts',
        default: './dist/index.js'
      }
    })
    expect(entrypoints2Exports({
      '.': './src/index.cts'
    }, {
      withSource: true
    })).toStrictEqual({
      '.': {
        require: {
          source: './src/index.cts',
          default: './dist/index.cjs'
        }
      }
    })
    expect(entrypoints2Exports({
      '.': {
        styless: './src/index.ts',
        foo: './src/index.foo.cts'
      }
    }, {
      withSource: true
    })).toStrictEqual({
      '.': {
        styless: {
          source: './src/index.ts',
          default: './dist/index.js'
        },
        foo: {
          require: {
            source: './src/index.foo.cts',
            default: './dist/index.foo.cjs'
          }
        }
      }
    })
  })
  test('with suffix', () => {
    expect(entrypoints2Exports('./src/index.ts', { withSuffix: true })).toStrictEqual({
      '.': './dist/index.js'
    })
    expect(entrypoints2Exports({
      '.': './src/index.ts'
    }, {
      withSuffix: true
    })).toStrictEqual({
      '.': './dist/index.js'
    })
    expect(entrypoints2Exports({
      './foo': './src/foo.ts'
    }, {
      withSuffix: true
    })).toStrictEqual({
      './foo': './dist/foo.js',
      './foo.js': './dist/foo.js'
    })
    expect(entrypoints2Exports({
      './foo.js': './src/foo.ts',
      './bar.cjs': './src/bar.cts',
      './baz.mjs': './src/baz.mts',
      './qux.jsx': './src/qux.tsx'
    }, {
      withSuffix: true
    })).toStrictEqual({
      './foo.js': './dist/foo.js',
      './bar.cjs': {
        'require': './dist/bar.cjs'
      },
      './baz.mjs': {
        'import': './dist/baz.mjs'
      },
      './qux.jsx': './dist/qux.js'
    })
    expect(entrypoints2Exports({
      './package.json': './package.json'
    }, { withSuffix: true }))
      .toStrictEqual({
        './package.json': './package.json'
      })
  })
  test('skipKey', () => {
    expect(entrypoints2Exports({
      './package.json': './package.json',
      './foo.d.ts': './dist/foo.d.ts'
    })).toStrictEqual({
      './package.json': './package.json',
      './foo.d.ts': './dist/foo.d.ts'
    })
  })
  test('skipValue', () => {
    expect(entrypoints2Exports({
      '.': './src/index.ts',
      './package': './package.json',
      './foo': './dist/foo.d.ts'
    })).toStrictEqual({
      '.': './dist/index.js',
      './package': './package.json',
      './foo': './dist/foo.d.ts'
    })
    expect(entrypoints2Exports({
      '.': './src/index.ts',
      './package': {
        a: './package.json'
      }
    })).toStrictEqual({
      '.': './dist/index.js',
      './package': {
        a: './package.json'
      }
    })
  })
  test('conditional suffixes', () => {
    expect(entrypoints2Exports({
      '.': './src/index.ts'
    }, {
      withConditional: {
        source: true,
        styless: ({ dist }) => dist.replace(/(\.[cm]?js)$/, '.styless$1'),
        bundled: ({ dist }) => dist.replace(/(\.[cm]?js)$/, '.bundled$1')
      }
    })).toStrictEqual({
      '.': {
        source: './src/index.ts',
        styless: './dist/index.styless.js',
        bundled: './dist/index.bundled.js',
        default: './dist/index.js'
      }
    })
    expect(entrypoints2Exports({
      '.': './src/index.cts'
    }, {
      withConditional: {
        source: true,
        bundled: ({ dist }) => dist.replace(/(\.[cm]?js)$/, '.bundled$1')
      }
    })).toStrictEqual({
      '.': {
        require: {
          source: './src/index.cts',
          bundled: './dist/index.bundled.cjs',
          default: './dist/index.cjs'
        }
      }
    })
    expect(entrypoints2Exports({
      '.': {
        foo: './src/index.ts',
        bar: './src/index.bar.ts'
      }
    }, {
      withConditional: {
        source: true,
        bundled: ({ dist }) => dist.replace(/(\.[cm]?js)$/, '.bundled$1')
      }
    })).toStrictEqual({
      '.': {
        foo: {
          source: './src/index.ts',
          bundled: './dist/index.bundled.js',
          default: './dist/index.js'
        },
        bar: {
          source: './src/index.bar.ts',
          bundled: './dist/index.bar.bundled.js',
          default: './dist/index.bar.js'
        }
      }
    })
  })
})
