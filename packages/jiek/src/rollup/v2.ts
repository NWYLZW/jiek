import { resolve } from 'node:path'

import type { RecursiveRecord } from '@jiek/pkger/entrypoints'
import { entrypoints2Exports, getAllLeafs, resolveEntrypoints } from '@jiek/pkger/entrypoints'
import { dts } from '@jiek/rollup-plugin-dts'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import type { OutputOptions, OutputPlugin, Plugin, RollupOptions } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'

export interface TemplateOptions {
}

interface PackageJSON {
  name?: string
  type?: string
  exports?: Record<string, unknown> | string | string[]
}

const {
  JIEK_ROOT
} = process.env
const WORKSPACE_ROOT = JIEK_ROOT ?? getWorkspaceDir()
const COMMON_OPTIONS = {} satisfies RollupOptions
const COMMON_PLUGINS = [
  json()
]

const resolveWorkspacePath = (p: string) => resolve(WORKSPACE_ROOT, p)

const pascalCase = (str: string) =>
  str
    .replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
    .replace(/(?:^|-)(\w)/g, (_, $1) => $1.toUpperCase())

const reveal = (obj: string | Record<string, unknown>, keys: string[]) =>
  keys.reduce((acc, key) => {
    if (typeof acc === 'string') throw new Error('key not found in exports')
    if (!(key in acc)) throw new Error(`key ${key} not found in exports`)
    return acc[key] as string | Record<string, unknown>
  }, obj)

const withMinify = (
  output: OutputOptions & {
    plugins?: OutputPlugin[]
  }
) => [
  output,
  {
    ...output,
    file: output.file?.replace(/(\.[cm]?js)$/, '.min$1'),
    plugins: [
      ...(output.plugins ?? []),
      terser()
    ]
  }
]

export function template(packageJSON: PackageJSON, options: TemplateOptions) {
  const { name, type, exports: entrypoints } = packageJSON
  const outdir = 'dist'
  if (!name) throw new Error('package.json name is required')
  if (!entrypoints) throw new Error('package.json exports is required')

  const packageName = pascalCase(name)
  const [, resolvedEntrypoints] = resolveEntrypoints(entrypoints)
  const exports = entrypoints2Exports(entrypoints, {})
  const leafMap = new Map<string, string[][]>()
  getAllLeafs(resolvedEntrypoints as RecursiveRecord<string>, ({ keys, value }) => {
    if (typeof value === 'string') {
      const keysArr = leafMap.get(value) ?? []
      leafMap.set(value, keysArr)
      keysArr.push(keys)
    }
    return false
  })
  const configs: (RollupOptions & {
    plugins: Plugin[]
  })[] = []
  leafMap.forEach((keysArr, input) =>
    keysArr.forEach((keys) => {
      const [path, ...conditionals] = keys

      const name = packageName + (path === '.' ? '' : pascalCase(path))
      const keyExports = reveal(exports, keys)

      switch (typeof keyExports) {
        case 'string': {
          configs.push({
            input,
            output: [
              ...withMinify({
                file: keyExports,
                name,
                format: type === 'module' ? 'esm' : 'cjs'
              })
            ],
            plugins: [
              esbuild()
            ]
          }, {
            input,
            output: [
              { dir: outdir }
            ],
            plugins: [
              dts({ tsconfig: resolveWorkspacePath('tsconfig.dts.json') })
            ]
          })
          break
        }
      }
    })
  )
  return configs.map(c => ({
    ...COMMON_OPTIONS,
    ...c,
    plugins: [
      ...COMMON_PLUGINS,
      ...(c.plugins ?? [])
    ]
  }))
}
