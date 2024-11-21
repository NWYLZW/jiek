import fs from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'

import type { RecursiveRecord } from '@jiek/pkger/entrypoints'
import { getAllLeafs } from '@jiek/pkger/entrypoints'
import { dts } from '@jiek/rollup-plugin-dts'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import { sendMessage } from 'execa'
import { isMatch } from 'micromatch'
import type { InputPluginOption, OutputOptions, OutputPlugin, RollupOptions } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import ts from 'typescript'

import { recusiveListFiles } from '#~/utils/recusiveListFiles.ts'

import { getExports } from '../utils/getExports'
import { loadConfig } from '../utils/loadConfig'
import { getCompilerOptionsByFilePath } from '../utils/ts'
import type { ConfigGenerateContext, RollupProgressEvent, TemplateOptions } from './base'
import progress from './plugins/progress'
import skip from './plugins/skip'
import externalResolver from './utils/externalResolver'

interface PackageJSON {
  name?: string
  type?: string
  exports?: Record<string, unknown> | string | string[]
}

const {
  JIEK_ROOT,
  JIEK_ENTRIES,
  JIEK_WITHOUT_JS,
  JIEK_WITHOUT_DTS
} = process.env
const WORKSPACE_ROOT = JIEK_ROOT ?? getWorkspaceDir()
const COMMON_OPTIONS = {} satisfies RollupOptions
const COMMON_PLUGINS = [
  json()
]
const WITHOUT_JS = JIEK_WITHOUT_JS === 'true'
const WITHOUT_DTS = JIEK_WITHOUT_DTS === 'true'

const config = loadConfig({
  root: WORKSPACE_ROOT
}) ?? {}
const { build = {} } = config
const jsOutdir = `./${
  relative(
    process.cwd(),
    resolve(
      (
        typeof build?.output?.dir === 'object'
          // the outdir only affect js output in this function
          ? build.output.dir.js
          : build?.output?.dir
      ) ?? 'dist'
    )
  )
}`

const STYLE_REGEXP = /\.(css|s[ac]ss|less|styl)$/

const resolveBuildPlugins = (context: ConfigGenerateContext, plugins: TemplateOptions['plugins']): {
  js: InputPluginOption
  dts: InputPluginOption
} => {
  if (plugins === false || plugins === undefined || plugins === null) {
    return { js: [], dts: [] }
  }
  let js: InputPluginOption = []
  let dts: InputPluginOption = []
  switch (typeof plugins) {
    case 'function':
      js = plugins('js', context)
      dts = plugins('dts', context)
      break
    case 'object':
      if ('js' in plugins || 'dts' in plugins) {
        js = plugins.js ?? []
        dts = plugins.dts ?? []
      } else {
        js = plugins
        dts = plugins
      }
      break
  }
  return { js, dts }
}

const resolveOutputControls = (
  context: ConfigGenerateContext,
  output: TemplateOptions['output']
): { js: boolean; dts: boolean } => ({
  js: typeof output?.js === 'boolean'
    ? output.js
    : typeof output?.js === 'function'
    ? output.js(context)
    : true,
  dts: typeof output?.dts === 'boolean'
    ? output.dts
    : typeof output?.dts === 'function'
    ? output.dts(context)
    : true
})

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
  },
  minify = build?.output?.minify
): OutputOptions[] =>
  minify === false
    ? [output]
    : minify === 'only-minify'
    ? [{
      ...output,
      // TODO replace suffix when pubish to npm and the `build.output.minify` is 'only-minify'
      // TODO resolve dts output file name
      entryFileNames: chunkInfo =>
        typeof output.entryFileNames === 'function'
          ? output.entryFileNames(chunkInfo)
          : (() => {
            throw new Error('entryFileNames must be a function')
          })(),
      plugins: [
        ...(output.plugins ?? []),
        terser()
      ]
    }]
    : [
      output,
      {
        ...output,
        entryFileNames: chunkInfo =>
          typeof output.entryFileNames === 'function'
            ? output.entryFileNames(chunkInfo).replace(/(\.[cm]?js)$/, '.min$1')
            : (() => {
              throw new Error('entryFileNames must be a function')
            })(),
        file: output.file?.replace(/(\.[cm]?js)$/, '.min$1'),
        plugins: [
          ...(output.plugins ?? []),
          terser()
        ]
      }
    ]

const generateConfigs = (context: ConfigGenerateContext, options: TemplateOptions = {}): RollupOptions[] => {
  const {
    path,
    name,
    input,
    output,
    external,
    pkgIsModule,
    conditionals
  } = context
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
    delete compilerOptions.composite
  }
  const exportConditions = [...conditionals, ...(compilerOptions.customConditions ?? [])]
  const throughEventProps: RollupProgressEvent & { type: 'progress' } = {
    type: 'progress',
    data: { name, path, exportConditions, input }
  }
  const outdir = options?.output?.dir
  const { js: jsPlugins, dts: dtsPlugins } = resolveBuildPlugins(context, build.plugins)
  if (input.includes('**')) {
    throw new Error(
      'input should not include "**", please read the [documentation](https://nodejs.org/api/packages.html#subpath-patterns).'
    )
  }
  const inputObj = !input.includes('*')
    ? input
    : recusiveListFiles(process.cwd())
      .filter(p => /(?<!\.d)\.[cm]?tsx?$/.test(p))
      .map(p => relative(process.cwd(), p))
      .filter(p => isMatch(p, input.slice(2)))
  const globCommonDir = input.includes('*')
    ? input.split('*')[0].replace('./', '')
    : ''
  const pathCommonDir = path.includes('*')
    ? path.split('*')[0].replace('./', '')
    : ''
  if (
    (globCommonDir.length > 0 && pathCommonDir.length === 0)
    || (globCommonDir.length === 0 && pathCommonDir.length > 0)
  ) {
    throw new Error('input and path should both include "*" or not include "*"')
  }
  const jsOutputSuffix = extname(output)
  const tsOutputSuffix = jsOutputSuffix.replace(/(\.[cm]?)js$/, '.d$1ts')
  const { js: jsOutput, dts: dtsOutput } = resolveOutputControls(context, build.output)
  const rollupOptions: RollupOptions[] = []
  if (jsOutput && !WITHOUT_JS) {
    rollupOptions.push({
      input: inputObj,
      external,
      output: [
        ...withMinify({
          dir: jsOutdir,
          name,
          interop: 'auto',
          entryFileNames: (chunkInfo) => (
            Array.isArray(inputObj)
              ? chunkInfo.facadeModuleId!.replace(`${process.cwd()}/`, '')
                .replace(globCommonDir, pathCommonDir)
                .replace(/(\.[cm]?)ts$/, jsOutputSuffix)
              : output.replace(`${jsOutdir}/`, '')
          ),
          sourcemap: typeof options?.output?.sourcemap === 'object'
            ? options.output.sourcemap.js
            : options?.output?.sourcemap,
          format: isModule ? 'esm' : (
            isCommonJS ? 'cjs' : (
              isBrowser ? 'umd' : (
                pkgIsModule ? 'esm' : 'cjs'
              )
            )
          ),
          strict: typeof options?.output?.strict === 'object'
            ? options.output.strict.js
            : options?.output?.strict
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
        esbuild({
          tsconfig: dtsTSConfigPath
        }),
        commonjs(),
        progress({
          onEvent: (event, message) =>
            sendMessage(
              {
                ...throughEventProps,
                data: { ...throughEventProps.data, event, message, tags: ['js'] }
              } satisfies RollupProgressEvent
            )
        }),
        jsPlugins
      ]
    })
  }
  if (dtsOutput && !WITHOUT_DTS) {
    rollupOptions.push({
      input: inputObj,
      external,
      output: [
        {
          dir: resolve((typeof outdir === 'object' ? outdir.dts : outdir) ?? 'dist'),
          sourcemap: typeof options?.output?.sourcemap === 'object'
            ? options.output.sourcemap.dts
            : options?.output?.sourcemap,
          entryFileNames: (chunkInfo) => (
            Array.isArray(inputObj)
              ? chunkInfo.facadeModuleId!.replace(`${process.cwd()}/`, '')
                .replace(globCommonDir, pathCommonDir)
                .replace(/(\.[cm]?)ts$/, tsOutputSuffix)
              : output
                .replace(`${jsOutdir}/`, '')
                .replace(/(\.[cm]?)js$/, tsOutputSuffix)
          ),
          strict: typeof options?.output?.strict === 'object'
            ? options.output.strict.dts
            : options?.output?.strict
        }
      ],
      plugins: [
        nodeResolve({ exportConditions }),
        skip({ patterns: [STYLE_REGEXP] }),
        dts({
          respectExternal: true,
          compilerOptions: {
            ...compilerOptions,
            // temp directory, it not affect the output
            // but if the user not set it and `declaration`, inputs can't generate any dts files when the input relative imports of `package.json`
            outDir: 'dist',
            declaration: true,
            // https://github.com/Swatinem/rollup-plugin-dts/issues/143
            preserveSymlinks: false,
            // Expected '{', got 'type' (Note that you need plugins to import files that are not JavaScript)
            // https://github.com/Swatinem/rollup-plugin-dts/issues/96
            noEmit: false
          }
        }),
        progress({
          onEvent: (event, message) =>
            sendMessage(
              {
                ...throughEventProps,
                data: { ...throughEventProps.data, event, message, tags: ['dts'] }
              } satisfies RollupProgressEvent
            )
        }),
        dtsPlugins
      ]
    })
  }
  return rollupOptions
}

export function template(packageJSON: PackageJSON): RollupOptions[] {
  const { name, type, exports: entrypoints } = packageJSON
  const pkgIsModule = type === 'module'
  if (!name) throw new Error('package.json name is required')
  if (!entrypoints) throw new Error('package.json exports is required')

  const entries = JIEK_ENTRIES
    ?.split(',')
    .map(e => e.trim())
    .map(e => ({
      'index': '.'
    }[e] ?? e))

  const packageName = pascalCase(name)

  const external = externalResolver(packageJSON as Record<string, unknown>)

  const [filteredResolvedEntrypoints, exports] = getExports({
    entrypoints,
    pkgIsModule,
    entries,
    config
  })

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
        external,
        pkgIsModule
      }

      switch (typeof keyExports) {
        case 'string': {
          configs.push(...generateConfigs({
            ...commonOptions,
            output: keyExports,
            conditionals
          }, build))
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
              }, build))
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
