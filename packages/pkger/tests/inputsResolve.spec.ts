import mock from 'mock-fs'
import { beforeAll, describe, expect, test } from 'vitest'
import { inputsResolve } from '../src'

beforeAll(() => mock.restore())

describe('inputsResolve', () => {
  test('index', () => {
    mock({
      'index.ts': '',
      'named.ts': '',
      'dir': {
        'index.ts': '',
        'named.ts': ''
      }
    })
    expect(inputsResolve(['index.ts'])).toStrictEqual({ '.': 'index.ts' })
    expect(inputsResolve(['named.ts'])).toStrictEqual({ '.': 'named.ts' })
    expect(inputsResolve(['dir/index.ts'])).toStrictEqual({ '.': 'dir/index.ts' })
    expect(inputsResolve(['dir/named.ts'])).toStrictEqual({ '.': 'dir/named.ts' })
  })
  test('named', () => {
    mock({
      'named.ts': '',
      'named': {
        'index.ts': ''
      },
      'dir': {
        'named.ts': ''
      }
    })
    expect(inputsResolve(['named.ts'], { noIndex: true })).toStrictEqual({ 'named': 'named.ts' })
    expect(inputsResolve(['named/index.ts'], { noIndex: true })).toStrictEqual({ 'named': 'named/index.ts' })
    expect(inputsResolve(['dir/named.ts'], { noIndex: true })).toStrictEqual({ 'dir/named': 'dir/named.ts' })
  })
  test('named with index', () => {
    mock({
      'index.ts': '',
      'named.ts': '',
      'named': {
        'index.ts': ''
      },
      'dir': {
        'index.ts': '',
        'named.ts': ''
      }
    })
    expect(inputsResolve(['index.ts', 'named.ts'])).toStrictEqual({ '.': 'index.ts', 'named': 'named.ts' })
    expect(inputsResolve(['index.ts', 'named/index.ts'])).toStrictEqual({ '.': 'index.ts', 'named': 'named/index.ts' })
    expect(inputsResolve(['index.ts', 'dir/named.ts'])).toStrictEqual({ '.': 'index.ts', 'dir/named': 'dir/named.ts' })
    expect(inputsResolve(['dir/index.ts', 'dir/named.ts'])).toStrictEqual({ '.': 'dir/index.ts', 'dir/named': 'dir/named.ts' })
  })
})
describe('glob', () => {
  test('all', () => {
    mock({
      'index.ts': '',
      'named.ts': '',
      'dir': {
        'index.ts': '',
        'named.ts': ''
      },
      'dir2': {
        'dir3': {
          'index.ts': '',
          'named.ts': ''
        }
      }
    })
    expect(inputsResolve(['*'])).toStrictEqual({
      '.': 'index.ts',
      'named': 'named.ts'
    })
    expect(inputsResolve(['*', '*/index.ts'])).toStrictEqual({
      '.': 'index.ts',
      'named': 'named.ts',
      'dir': 'dir/index.ts'
    })
    expect(inputsResolve(['*', '**/index.ts'])).toStrictEqual({
      '.': 'index.ts',
      'named': 'named.ts',
      'dir': 'dir/index.ts',
      'dir2/dir3': 'dir2/dir3/index.ts'
    })
  })
})
