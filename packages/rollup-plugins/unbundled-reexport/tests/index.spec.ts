import path from 'node:path'

import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { swc } from 'rollup-plugin-swc3'
import { describe, expect, test } from 'vitest'

import unbundledReexport from '../src'

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
