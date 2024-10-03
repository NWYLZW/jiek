import { resolve } from 'node:path'

import type { RecursiveRecord } from '@jiek/pkger/entrypoints'
import { DEFAULT_SKIP_VALUES } from '@jiek/pkger/entrypoints'
import { filterLeafs } from '@jiek/pkger/entrypoints'
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

const generateConfigs = ({
  name,
  input,
  output,
  outdir,
  pkgIsModule,
  conditionals
}: {
  name: string
  input: string
  output: string
  outdir: string
  pkgIsModule: boolean
  conditionals: string[]
}) => {
  const isModule = conditionals.includes('import')
  const isCommonJS = conditionals.includes('require')
  const isBrowser = conditionals.includes('browser')
  return [
    {
      input,
      output: [
        ...withMinify({
          file: output,
          name,
          format: isModule ? 'esm' : (
            isCommonJS ? 'cjs' : (
              isBrowser ? 'umd' : (
                pkgIsModule ? 'esm' : 'cjs'
              )
            )
          )
        })
      ],
      plugins: [
        esbuild()
      ]
    },
    {
      input,
      output: [
        { dir: outdir }
      ],
      plugins: [
        dts({ tsconfig: resolveWorkspacePath('tsconfig.dts.json') })
      ]
    }
  ]
}

export function template(packageJSON: PackageJSON, options: TemplateOptions = {}) {
  const { name, type, exports: entrypoints } = packageJSON
  const pkgIsModule = type === 'module'
  const outdir = 'dist'
  if (!name) throw new Error('package.json name is required')
  if (!entrypoints) throw new Error('package.json exports is required')

  const packageName = pascalCase(name)

  const [, resolvedEntrypoints] = resolveEntrypoints(entrypoints)
  const filteredResolvedEntrypoints = filterLeafs(
    resolvedEntrypoints as RecursiveRecord<string>,
    {
      skipValue: [
        // ignore values that filename start with `.jk-noentry`
        /(^|\/)\.jk-noentry/,
        ...DEFAULT_SKIP_VALUES
      ]
    }
  )
  const exports = entrypoints2Exports(filteredResolvedEntrypoints, {})

  const leafMap = new Map<string, string[][]>()
  getAllLeafs(filteredResolvedEntrypoints as RecursiveRecord<string>, ({ keys, value }) => {
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
          configs.push(...generateConfigs({
            name,
            input,
            output: keyExports,
            outdir,
            pkgIsModule,
            conditionals
          }))
          break
        }
        case 'object': {
          getAllLeafs(keyExports as RecursiveRecord<string>, ({ keys: nextKeys, value }) => {
            const allConditionals = [...new Set([...conditionals, ...nextKeys])]
            if (typeof value === 'string') {
              configs.push(...generateConfigs({
                name,
                input,
                output: value,
                outdir,
                pkgIsModule,
                conditionals: allConditionals
              }))
            }
            return false
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
