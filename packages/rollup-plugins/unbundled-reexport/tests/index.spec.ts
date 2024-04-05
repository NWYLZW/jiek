import path from 'node:path'

import { rollup } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { test } from 'vitest'

import unbundledReexport from '../src'

const fixtures = (...p: string[]) => path.resolve(__dirname, 'fixtures', ...p)

test('base', async () => {
  const { generate } = await rollup({
    input: fixtures('index.ts'),
    plugins: [
      unbundledReexport(['./utils']),
      esbuild()
    ]
  })
  const { output } = await generate({ format: 'esm' })
})
