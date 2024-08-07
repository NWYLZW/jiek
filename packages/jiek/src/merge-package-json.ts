import path from 'node:path'

import { type Options, pkger } from '@jiek/pkger'
import { commondir } from '@jiek/utils/commondir'
import type { Manifest } from '@pnpm/workspace.pkgs-graph'

export function mergePackageJson(manifest: Manifest & {
  jiek?: Options
  exports?: unknown | unknown[]
}, cwd: string, options: {
  excludeDistInExports?: boolean
} = {}) {
  const {
    excludeDistInExports = false
  } = options
  const {
    jiek: { cwd: _, ...jiek } = {}
  } = manifest
  const { outdir = 'dist' } = jiek
  let { exports } = manifest
  let includeIndex = false
  if (typeof exports === 'string') {
    includeIndex = true
    exports = { '.': exports }
  }
  if (exports === undefined) {
    exports = { '.': './src/index.ts' }
  }
  if (typeof exports === 'object') {
    if (Array.isArray(exports) && exports.length > 0) {
      includeIndex = true
    } else {
      includeIndex = !!(<Record<string, unknown>>exports)['.']
    }
  }
  let inputs = Array.isArray(exports)
    ? exports as string[]
    : Object
      .entries(<Record<string, unknown>>exports)
      .reduce((acc, [key, value]) => {
        if (typeof value === 'string') return key === '.'
          ? [value, ...acc]
          : acc.concat(value)
        if (Array.isArray(value)) return acc.concat(value)

        throw new TypeError(`Unexpected value type for key "${key}" in exports, expected string, got ${typeof value}`)
      }, [] as string[])
  if (excludeDistInExports) {
    inputs = inputs.filter(input => !input.startsWith(`./${outdir}`) && !input.startsWith(outdir))
  }
  if (inputs.length === 0)
    throw new Error('No inputs found')

  const absoluteInputs = inputs.map(input => path.isAbsolute(input)
    ? input
    : path.resolve(cwd, input)
  )
  let cDir = path.dirname(absoluteInputs[0])
  if (absoluteInputs.length > 1) {
    cDir = commondir(absoluteInputs, cwd)
  }
  const resolvedInputs = absoluteInputs.map(input => {
    return path.relative(cDir, input)
  })
  return {
    ...manifest,
    ...pkger({
      cwd,
      noIndex: !includeIndex,
      source: path.relative(cwd, cDir),
      inputs: resolvedInputs,
      ...jiek
    })
  }
}
