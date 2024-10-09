import fs from 'node:fs'
import { dirname, resolve } from 'node:path'

import type { RecursiveRecord } from '@jiek/pkger/entrypoints'
import {
  DEFAULT_SKIP_VALUES,
  entrypoints2Exports,
  filterLeafs,
  getAllLeafs,
  resolveEntrypoints
} from '@jiek/pkger/entrypoints'
import { dts } from '@jiek/rollup-plugin-dts'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import { sendMessage } from 'execa'
import { parse } from 'jsonc-parser'
import { isMatch } from 'micromatch'
import type { OutputOptions, OutputPlugin, RollupOptions } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import ts from 'typescript'

import type { RollupProgressEvent } from './base'
import progress from './plugins/progress'
import skip from './plugins/skip'
import externalResolver from './utils/externalResolver'

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

const STYLE_REGEXP = /\.(css|s[ac]ss|less|styl)$/

// eslint-disable-next-line unused-imports/no-unused-vars
const debug = (...args: unknown[]) => sendMessage({ type: 'debug', data: args } satisfies RollupProgressEvent)

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

type TSConfig = {
  extends?: string | string[]
  compilerOptions?: Record<string, unknown>
  references?: { path: string }[]
  files?: string[]
  include?: string[]
  exclude?: string[]
}

const getTSConfig = (p: string): TSConfig =>
  !fs.existsSync(p) || !fs.statSync(p).isFile()
    ? {}
    : parse(fs.readFileSync(p, 'utf-8'), [], { allowTrailingComma: true, allowEmptyContent: true })

const getExtendTSConfig = (tsconfigPath: string): TSConfig => {
  tsconfigPath = resolve(tsconfigPath)
  const tsconfigPathDirname = dirname(tsconfigPath)
  const { extends: exts, ...tsconfig } = getTSConfig(tsconfigPath)
  const resolvePaths = (paths: string[] | undefined) => paths?.map(p => resolve(tsconfigPathDirname, p)) ?? []

  const extendsPaths = resolvePaths(
    exts ? Array.isArray(exts) ? exts : [exts] : []
  )
  if (extendsPaths.length === 0) return tsconfig
  return extendsPaths
    .map(getExtendTSConfig)
    // https://www.typescriptlang.org/tsconfig/#files:~:text=Currently%2C%20the%20only%20top%2Dlevel%20property%20that%20is%20excluded%20from%20inheritance%20is%20references.
    // Currently, the only top-level property that is excluded from inheritance is references.
    .reduce((acc, { compilerOptions = {}, references: _, ...curr }) => ({
      ...acc,
      ...curr,
      compilerOptions: {
        ...acc.compilerOptions,
        ...compilerOptions
      }
    }), tsconfig)
}

const getCompilerOptionsByFilePath = (tsconfigPath: string, filePath: string): Record<string, unknown> | undefined => {
  tsconfigPath = resolve(tsconfigPath)
  filePath = resolve(filePath)
  const tsconfigPathDirname = dirname(tsconfigPath)
  // https://www.typescriptlang.org/tsconfig/#files:~:text=It%E2%80%99s%20worth%20noting%20that%20files%2C%20include%2C%20and%20exclude%20from%20the%20inheriting%20config%20file%20overwrite%20those%20from%20the%20base%20config%20file%2C%20and%20that%20circularity%20between%20configuration%20files%20is%20not%20allowed.
  // It’s worth noting that files, include, and exclude from the inheriting config file overwrite
  // those from the base config file, and that circularity between configuration files is not allowed.
  const tsconfig = getExtendTSConfig(tsconfigPath)

  const resolvePaths = (paths: string[] | undefined) => paths?.map(p => resolve(tsconfigPathDirname, p)) ?? []

  const [
    references,
    files,
    include,
    exclude
  ] = [
    tsconfig.references?.map(({ path }) => path),
    tsconfig.files,
    tsconfig.include,
    tsconfig.exclude
  ].map(resolvePaths)
  if (exclude.length > 0 && exclude.some(i => isMatch(filePath, i))) return

  // when files or include is not empty, the tsconfig should be ignored
  if (tsconfig.files?.length === 0 && tsconfig.include?.length === 0) return
  let isInclude = false
  isInclude ||= files.length > 0 && files.includes(filePath)
  isInclude ||= include.length > 0 && include.some(i => isMatch(filePath, i))
  if (isInclude) {
    return tsconfig.compilerOptions ?? {}
  } else {
    // when files or include is not empty, but the file is not matched, the tsconfig should be ignored
    if (
      (tsconfig.files && tsconfig.files.length > 0)
      || (tsconfig.include && tsconfig.include.length > 0)
    ) return
  }

  references.reverse()
  for (const ref of references) {
    const compilerOptions = getCompilerOptionsByFilePath(ref, filePath)
    if (compilerOptions) return compilerOptions
  }
  return tsconfig.compilerOptions
}

const generateConfigs = ({
  path,
  name,
  input,
  output,
  outdir,
  external,
  pkgIsModule,
  conditionals
}: {
  path: string
  name: string
  input: string
  output: string
  outdir: string
  external: (string | RegExp)[]
  pkgIsModule: boolean
  conditionals: string[]
}): RollupOptions[] => {
  const isModule = conditionals.includes('import')
  const isCommonJS = conditionals.includes('require')
  const isBrowser = conditionals.includes('browser')
  const dtsTSConfigPaths = [
    resolveWorkspacePath('tsconfig.json'),
    resolveWorkspacePath('tsconfig.dts.json')
  ]
  let dtsTSConfigPath: string | undefined
  dtsTSConfigPaths.forEach(p => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      dtsTSConfigPath = p
    }
  })
  let compilerOptions: ts.CompilerOptions = {}
  if (dtsTSConfigPath) {
    const jsonCompilerOptions = getCompilerOptionsByFilePath(dtsTSConfigPath, resolve(input))
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      jsonCompilerOptions,
      dirname(dtsTSConfigPath)
    )
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.messageText).join('\n'))
    }
    compilerOptions = options
  }
  const exportConditions = [...conditionals, ...(compilerOptions.customConditions ?? [])]
  const throughEventProps: RollupProgressEvent & { type: 'progress' } = {
    type: 'progress',
    data: { name, path, exportConditions, input }
  }
  return [
    {
      input,
      external,
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
        nodeResolve({ exportConditions }),
        import('rollup-plugin-postcss')
          .then(({ default: postcss }) =>
            postcss({
              extract: resolve(output.replace(/\.[cm]?js$/, '.css')),
              minimize: true
            })
          )
          .catch(() => void 0),
        esbuild(),
        progress({
          onEvent: (event, message) =>
            sendMessage(
              {
                ...throughEventProps,
                data: { ...throughEventProps.data, event, message, tags: ['js'] }
              } satisfies RollupProgressEvent
            )
        })
      ]
    },
    {
      input,
      external,
      output: [
        {
          dir: outdir,
          entryFileNames: () => input.replace(/^\.\/src\//, '').replace(/(.[cm]?ts)$/, '.d$1')
        }
      ],
      plugins: [
        nodeResolve({ exportConditions }),
        skip({ patterns: [STYLE_REGEXP] }),
        dts({
          respectExternal: true,
          compilerOptions
        }),
        progress({
          onEvent: (event, message) =>
            sendMessage(
              {
                ...throughEventProps,
                data: { ...throughEventProps.data, event, message, tags: ['dts'] }
              } satisfies RollupProgressEvent
            )
        })
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

  const external = externalResolver(packageJSON as Record<string, unknown>)

  const [, resolvedEntrypoints] = resolveEntrypoints(entrypoints)
  const filteredResolvedEntrypoints = filterLeafs(
    resolvedEntrypoints as RecursiveRecord<string>,
    {
      skipValue: [
        // ignore values that filename starts with `.jk-noentry`
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

  const configs: RollupOptions[] = []
  leafMap.forEach((keysArr, input) =>
    keysArr.forEach((keys) => {
      const [path, ...conditionals] = keys

      const name = packageName + (path === '.' ? '' : pascalCase(path))
      const keyExports = reveal(exports, keys)
      const commonOptions = {
        path,
        name,
        input,
        outdir,
        external,
        pkgIsModule
      }

      switch (typeof keyExports) {
        case 'string': {
          configs.push(...generateConfigs({
            ...commonOptions,
            output: keyExports,
            conditionals
          }))
          break
        }
        case 'object': {
          getAllLeafs(keyExports as RecursiveRecord<string>, ({ keys: nextKeys, value }) => {
            const allConditionals = [...new Set([...conditionals, ...nextKeys])]
            if (typeof value === 'string') {
              configs.push(...generateConfigs({
                ...commonOptions,
                output: value,
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
  sendMessage(
    {
      type: 'init',
      data: {
        leafMap,
        targetsLength: configs.length
      }
    } satisfies RollupProgressEvent
  )
  return configs.map(c => ({
    ...COMMON_OPTIONS,
    ...c,
    plugins: [
      ...COMMON_PLUGINS,
      c.plugins
    ]
  }))
}
