import path from 'node:path'

import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { swc } from 'rollup-plugin-swc3'
import { describe, expect, test } from 'vitest'

import unbundledReexport, { IMPORT_REG } from '../src'

const fixtures = (...p: string[]) => path.resolve(__dirname, 'fixtures', ...p)

describe('with attributes', () => {
  const root = (...p: string[]) => fixtures('with-attributes', ...p)
  test('swc', async () => {
    const { generate } = await rollup({
      input: root('index.ts'),
      plugins: [
        unbundledReexport(),
        swc()
      ]
    })
    const { output: [index] } = await generate({
      format: 'esm',
      preserveModules: true
    })
    expect(index.code).toBe('import { foo } from \'./utils/foo.js\';\n\nconsole.log(foo());\n')
  })
  test('esbuild', async () => {
    const { generate } = await rollup({
      input: root('index.ts'),
      plugins: [
        unbundledReexport(),
        esbuild()
      ]
    })
    const { output: [index] } = await generate({
      format: 'esm',
      preserveModules: true
    })
    expect(index.code).toBe('import { foo } from \'./utils/foo.js\';\n\nconsole.log(foo());\n')
  })
})

describe('import regexp', () => {
  test('start with', () => {
    const [
      { 1: a0, 2: b0 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\'')]
    expect(a0).toBe('{ a }')
    expect(b0).toBe('b')
    const [
      { 1: a1, 2: b1 }
    ] = [...IMPORT_REG[Symbol.matchAll](';import { a } from \'b\'')]
    expect(a1).toBe('{ a }')
    expect(b1).toBe('b')
    const [
      { 1: a2, 2: b2 }
    ] = [...IMPORT_REG[Symbol.matchAll]('\nimport { a } from \'b\'')]
    expect(a2).toBe('{ a }')
    expect(b2).toBe('b')
    const [
      { 1: a3, 2: b3 }
    ] = [...IMPORT_REG[Symbol.matchAll]('/**/import { a } from \'b\'')]
    expect(a3).toBe('{ a }')
    expect(b3).toBe('b')
    expect(IMPORT_REG[Symbol.matchAll]('//import { a } from \'b\'').next().done).toBe(true)
    expect(IMPORT_REG[Symbol.matchAll]('/*import { a } from \'b\'*/').next().done).toBe(true)
    expect(IMPORT_REG[Symbol.matchAll]('\'import { a } from \'b\'\'').next().done).toBe(true)
  })
  test('end with', () => {
    const [
      { 1: a0, 2: b0 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\'')]
    expect(a0).toBe('{ a }')
    expect(b0).toBe('b')
    const [
      { 1: a1, 2: b1 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\';')]
    expect(a1).toBe('{ a }')
    expect(b1).toBe('b')
    const [
      { 1: a2, 2: b2 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\'\n')]
    expect(a2).toBe('{ a }')
    expect(b2).toBe('b')
    const [
      { 1: a3, 2: b3 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\';\n')]
    expect(a3).toBe('{ a }')
    expect(b3).toBe('b')
  })
  test('with attributes', () => {
    const [
      { 1: a0, 2: b0, 3: c0 }
    ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\' with { attributes }')]
    expect(a0).toBe('{ a }')
    expect(b0).toBe('b')
    expect(c0).toBe(' attributes ')
  })
  describe('multiple', () => {
    test('identify', () => {
      const [
        { 1: a0, 2: b0 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import {\na } from \'b\'')]
      expect(a0).toBe('{\na }')
      expect(b0).toBe('b')
      const [
        { 1: a1, 2: b1 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import\n { a } from \'b\'')]
      expect(a1).toBe('{ a }')
      expect(b1).toBe('b')
      const [
        { 1: a2, 2: b2 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import\n { \na\n } \nfrom \'b\'')]
      expect(a2).toBe('{ \na\n }')
      expect(b2).toBe('b')
    })
    test('source', () => {
      const [
        { 1: a0, 2: b0 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \n\'b\'')]
      expect(a0).toBe('{ a }')
      expect(b0).toBe('b')
      const [
        { 1: a1, 2: b1 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\'\n;')]
      expect(a1).toBe('{ a }')
      expect(b1).toBe('b')
    })
    test('attributes', () => {
      const [
        { 1: a0, 2: b0, 3: c0 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\' with { \nattributes }')]
      expect(a0).toBe('{ a }')
      expect(b0).toBe('b')
      expect(c0).toBe(' \nattributes ')
    })
    test('imports', () => {
      const [
        { 1: a0, 2: b0 },
        { 1: a1, 2: b1 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import { a } from \'b\'\nimport { c } from \'d\'')]
      expect(a0).toBe('{ a }')
      expect(b0).toBe('b')
      expect(a1).toBe('{ c }')
      expect(b1).toBe('d')
      const [
        { 1: a2, 2: b2 },
        { 1: a3, 2: b3 }
      ] = [...IMPORT_REG[Symbol.matchAll]('import {\n a } from \n\'b\'\nimport {\n c } from \n\'d\'')]
      expect(a2).toBe('{\n a }')
      expect(b2).toBe('b')
      expect(a3).toBe('{\n c }')
      expect(b3).toBe('d')
    })
  })
})
