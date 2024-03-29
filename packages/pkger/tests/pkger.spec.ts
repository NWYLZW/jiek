import mock from 'mock-fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { pkger } from '../src'

beforeAll(() => mock.restore())

describe('pkger', () => {
  test('base', () => {
    mock({
      src: {
        'named.ts': '',
        'index.ts': '',
        'dir': {
          'index.ts': '',
          'named.ts': ''
        }
      }
    })
    expect(pkger({})).toStrictEqual({
      types: 'dist/index.d.ts',
      main: 'dist/index.umd.js',
      module: 'dist/index.esm.js',
      unpkg: 'dist/index.umd.js',
      jsdelivr: 'dist/index.umd.js',
      browser: 'dist/index.umd.js',
      typesVersions: { '<5.0': [ '*', 'dist/*', 'dist/*/index.esm.d.ts' ] },
      exports: {
        '.': {
          types: 'dist/index.d.ts',
          import: 'dist/index.esm.js',
          default: 'dist/index.esm.js',
          require: 'dist/index.umd.js'
        }
      }
    })
    expect(pkger({ inputs: ['named.ts'] })).toStrictEqual({
      types: 'dist/named.d.ts',
      main: 'dist/named.umd.js',
      module: 'dist/named.esm.js',
      unpkg: 'dist/named.umd.js',
      jsdelivr: 'dist/named.umd.js',
      browser: 'dist/named.umd.js',
      typesVersions: { '<5.0': [ '*', 'dist/*', 'dist/*/index.esm.d.ts' ] },
      exports: {
        '.': {
          types: 'dist/named.d.ts',
          import: 'dist/named.esm.js',
          default: 'dist/named.esm.js',
          require: 'dist/named.umd.js'
        }
      }
    })
    expect(pkger({ inputs: ['named.ts'], noIndex: true })).toStrictEqual({
      typesVersions: { '<5.0': [ '*', 'dist/*', 'dist/*/index.esm.d.ts' ] },
      exports: {
        named: {
          types: 'dist/named.d.ts',
          import: 'dist/named.esm.js',
          default: 'dist/named.esm.js',
          require: 'dist/named.umd.js'
        }
      }
    })
    expect(pkger({ inputs: ['*'] })).toStrictEqual({
      types: 'dist/index.d.ts',
      main: 'dist/index.umd.js',
      module: 'dist/index.esm.js',
      unpkg: 'dist/index.umd.js',
      jsdelivr: 'dist/index.umd.js',
      browser: 'dist/index.umd.js',
      typesVersions: { '<5.0': [ '*', 'dist/*', 'dist/*/index.esm.d.ts' ] },
      exports: {
        '.': {
          types: 'dist/index.d.ts',
          import: 'dist/index.esm.js',
          default: 'dist/index.esm.js',
          require: 'dist/index.umd.js'
        },
        named: {
          types: 'dist/named.d.ts',
          import: 'dist/named.esm.js',
          default: 'dist/named.esm.js',
          require: 'dist/named.umd.js'
        }
      }
    })
    expect(pkger({ inputs: ['*', '*/index.ts'] })).toStrictEqual({
      types: 'dist/index.d.ts',
      main: 'dist/index.umd.js',
      module: 'dist/index.esm.js',
      unpkg: 'dist/index.umd.js',
      jsdelivr: 'dist/index.umd.js',
      browser: 'dist/index.umd.js',
      typesVersions: { '<5.0': [ '*', 'dist/*', 'dist/*/index.esm.d.ts' ] },
      exports: {
        '.': {
          types: 'dist/index.d.ts',
          import: 'dist/index.esm.js',
          default: 'dist/index.esm.js',
          require: 'dist/index.umd.js'
        },
        named: {
          types: 'dist/named.d.ts',
          import: 'dist/named.esm.js',
          default: 'dist/named.esm.js',
          require: 'dist/named.umd.js'
        },
        dir: {
          types: 'dist/dir/index.d.ts',
          import: 'dist/dir/index.esm.js',
          default: 'dist/dir/index.esm.js',
          require: 'dist/dir/index.umd.js'
        }
      }
    })
  })
})
