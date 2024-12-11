/* eslint-disable ts/strict-boolean-expressions */
import fs from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import process from 'node:process'

import type { RecursiveRecord } from '@jiek/pkger/entrypoints'
import { getAllLeafs } from '@jiek/pkger/entrypoints'
import { dts } from '@jiek/rollup-plugin-dts'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import commonjs from '@rollup/plugin-commonjs'
import inject from '@rollup/plugin-inject'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { isMatch } from 'micromatch'
import type { InputPluginOption, OutputOptions, OutputPlugin, OutputPluginOption, Plugin, RollupOptions } from 'rollup'
import ts from 'typescript'

import type { RollupBuildEntryCtx, RollupBuildEventMap } from '#~/bridge.ts'
import { publish } from '#~/bridge.ts'
import { bundleAnalyzer } from '#~/rollup/bundle-analyzer.ts'
import { getExports, getOutDirs } from '#~/utils/getExports.ts'
import { loadConfig } from '#~/utils/loadConfig.ts'
import { recusiveListFiles } from '#~/utils/recusiveListFiles.ts'
import { getCompilerOptionsByFilePath } from '#~/utils/ts.ts'

import type { ConfigGenerateContext, TemplateOptions } from './base'
import createRequire, { CREATE_REQUIRE_VIRTUAL_MODULE_NAME } from './plugins/create-require'
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
  JIEK_NAME,
  JIEK_BUILDER,
  JIEK_ENTRIES,
  JIEK_EXTERNAL,
  JIEK_WITHOUT_JS,
  JIEK_WITHOUT_DTS,
  JIEK_WITHOUT_MINIFY,
  JIEK_MINIFY_TYPE,
  JIEK_CLEAN,
  JIEK_ONLY_MINIFY,
  JIEK_TSCONFIG,
  JIEK_DTSCONFIG
} = process.env

const resolveArrayString = (str: string | undefined) => {
  const arr = [
    ...new Set(
      str
        ?.split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0)
        ?? []
    )
  ]
  return arr?.length ? arr : undefined
}

const entries = resolveArrayString(JIEK_ENTRIES)?.map(e => ({ 'index': '.' }[e] ?? e))

const commandExternal = resolveArrayString(JIEK_EXTERNAL)?.map(e => new RegExp(`^${e}$`))

const WORKSPACE_ROOT = JIEK_ROOT ?? getWorkspaceDir()
const COMMON_OPTIONS = {} satisfies RollupOptions
const COMMON_PLUGINS = [
  json()
]

const WITHOUT_JS = JIEK_WITHOUT_JS === 'true'
const WITHOUT_DTS = JIEK_WITHOUT_DTS === 'true'
const WITHOUT_MINIFY = JIEK_WITHOUT_MINIFY === 'true'

const ONLY_MINIFY = JIEK_ONLY_MINIFY === 'true'

const CLEAN = JIEK_CLEAN === 'true'

const MINIFY_DEFAULT_VALUE = WITHOUT_MINIFY
  ? false
  : ONLY_MINIFY
  ? 'only-minify'
  : true

type BuilderOptions = NonNullable<TemplateOptions['builder']>

const BUILDER_OPTIONS = {
  type: JIEK_BUILDER ?? 'esbuild'
} as NonNullable<Exclude<BuilderOptions, string>>

type MinifyOptions = NonNullable<TemplateOptions['output']>['minifyOptions']

const MINIFY_OPTIONS = {
  type: JIEK_MINIFY_TYPE ?? 'esbuild'
} as NonNullable<Exclude<MinifyOptions, string>>

const config = loadConfig({
  root: WORKSPACE_ROOT
}) ?? {}
const { build = {} } = config
const { js: jsOutdir, dts: dtsOutdir } = getOutDirs({
  config,
  pkgName: JIEK_NAME
})

if (CLEAN) {
  fs.existsSync(jsOutdir) && fs.rmdirSync(jsOutdir, { recursive: true })
  fs.existsSync(dtsOutdir) && fs.rmdirSync(dtsOutdir, { recursive: true })
}

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
  // eslint-disable-next-line ts/switch-exhaustiveness-check
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
    // eslint-disable-next-line ts/no-unsafe-member-access,ts/no-unsafe-return,ts/no-unsafe-call
    .replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
    // eslint-disable-next-line ts/no-unsafe-member-access,ts/no-unsafe-return,ts/no-unsafe-call
    .replace(/(?:^|-)(\w)/g, (_, $1) => $1.toUpperCase())

const reveal = (obj: string | Record<string, unknown>, keys: string[]) =>
  keys.reduce((acc, key) => {
    if (typeof acc === 'string') throw new Error('key not found in exports')
    if (!(key in acc)) throw new Error(`key ${key} not found in exports`)
    return acc[key] as string | Record<string, unknown>
  }, obj)

const resolveMinifyOptions = (minifyOptions: MinifyOptions): typeof MINIFY_OPTIONS =>
  typeof minifyOptions === 'string'
    ? { type: minifyOptions }
    : minifyOptions ?? { type: 'esbuild' }

const resolveBuilderOptions = (
  builder: TemplateOptions['builder']
): Exclude<TemplateOptions['builder'], string | undefined> =>
  typeof builder === 'string'
    ? { type: builder }
    : builder ?? { type: 'esbuild' }

const resolvedMinifyOptions = resolveMinifyOptions(build.output?.minifyOptions ?? MINIFY_OPTIONS)
const { type: _resolvedMinifyOptionsType, ...noTypeResolvedMinifyOptions } = resolvedMinifyOptions
const resolvedBuilderOptions = resolveBuilderOptions(build.builder ?? BUILDER_OPTIONS)
const { type: _resolvedBuilderOptionsType, ...noTypeResolvedBuilderOptions } = resolvedBuilderOptions

const withMinify = (
  output: OutputOptions & {
    plugins?: OutputPlugin[]
  },
  onlyOncePlugins: OutputPluginOption[] = []
): OutputOptions[] => {
  const minify = build?.output?.minify ?? MINIFY_DEFAULT_VALUE

  output.plugins = output.plugins ?? []
  const notOnlyOncePlugins = [...output.plugins]
  output.plugins.push(...onlyOncePlugins)

  if (minify === false) {
    return [output]
  }

  const minifyPlugin = resolvedMinifyOptions.type === 'esbuild'
    // eslint-disable-next-line ts/no-unsafe-argument
    ? import('rollup-plugin-esbuild').then(({ minify }) => minify(noTypeResolvedMinifyOptions as any))
    : resolvedMinifyOptions.type === 'swc'
    // eslint-disable-next-line ts/no-unsafe-argument
    ? import('rollup-plugin-swc3').then(({ minify }) => minify(noTypeResolvedMinifyOptions as any))
    // eslint-disable-next-line ts/no-unsafe-argument
    : import('@rollup/plugin-terser').then(({ default: minify }) => minify(noTypeResolvedMinifyOptions as any))
  return minify === 'only-minify'
    ? [{
      ...output,
      // TODO replace suffix when publish to npm and the `build.output.minify` is 'only-minify'
      // TODO resolve dts output file name
      entryFileNames: chunkInfo =>
        typeof output.entryFileNames === 'function'
          ? output.entryFileNames(chunkInfo)
          : (() => {
            throw new Error('entryFileNames must be a function')
          })(),
      plugins: [
        ...output.plugins,
        ...notOnlyOncePlugins,
        minifyPlugin
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
          ...notOnlyOncePlugins,
          minifyPlugin
        ]
      }
    ]
}

const generateConfigs = (context: ConfigGenerateContext, options: TemplateOptions = {}): RollupOptions[] => {
  const {
    path,
    name,
    input,
    output,
    external: inputExternal,
    pkgIsModule,
    conditionals
  } = context
  const external = [...inputExternal, ...(options.external ?? []), ...(commandExternal ?? [])]
  const isModule = conditionals.includes('import')
  const isCommonJS = conditionals.includes('require')
  const isBrowser = conditionals.includes('browser')
  const format = isModule ? 'esm' : (
    isCommonJS ? 'cjs' : (
      isBrowser ? 'umd' : (
        pkgIsModule ? 'esm' : 'cjs'
      )
    )
  )

  const dtsTSConfigPaths = [
    resolveWorkspacePath('tsconfig.json'),
    resolveWorkspacePath('tsconfig.dts.json')
  ]
  JIEK_TSCONFIG && dtsTSConfigPaths.push(resolveWorkspacePath(JIEK_TSCONFIG))
  JIEK_DTSCONFIG && dtsTSConfigPaths.push(resolveWorkspacePath(JIEK_DTSCONFIG))
  const buildTSConfigPaths = [
    ...dtsTSConfigPaths,
    resolveWorkspacePath('tsconfig.build.json')
  ]
  // 这里重复写了俩次 JIEK_TSCONFIG 到 tsconfig 的加载列表中
  // 目的是保证在 build 的时候，JIEK_TSCONFIG 的优先级高于 JIEK_DTSCONFIG
  JIEK_TSCONFIG && buildTSConfigPaths.push(resolveWorkspacePath(JIEK_TSCONFIG))
  let dtsTSConfigPath: string | undefined
  dtsTSConfigPaths.forEach(p => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      dtsTSConfigPath = p
    }
  })
  let buildTSConfigPath: string | undefined
  buildTSConfigPaths.forEach(p => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      buildTSConfigPath = p
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
  const publishInEntry = <K extends keyof RollupBuildEventMap>(
    type: K,
    data: Omit<RollupBuildEventMap[K], keyof RollupBuildEntryCtx>
  ) =>
    // eslint-disable-next-line ts/no-unsafe-argument
    void publish(type, {
      ...{
        type: format,
        name,
        path,
        exportConditions,
        input
      } as RollupBuildEntryCtx,
      ...data
    } as any)

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

  const commonPlugins: Plugin[] = [
    nodeResolve({
      exportConditions,
      extensions: [
        '.js',
        '.cjs',
        '.mjs',
        '.jsx',
        '.cjsx',
        '.mjsx',
        '.ts',
        '.cts',
        '.mts',
        '.tsx',
        '.ctsx',
        '.mtsx'
      ]
    })
  ]
  if (jsOutput && !WITHOUT_JS) {
    const sourcemap = typeof options?.output?.sourcemap === 'object'
      ? options.output.sourcemap.js
      : options?.output?.sourcemap
    const features = Object.assign({
      keepImportAttributes: true
    }, build.features)
    const builder = resolvedBuilderOptions.type === 'esbuild'
      ? import('rollup-plugin-esbuild').then(({ default: esbuild }) =>
        esbuild({
          sourceMap: sourcemap === 'hidden' ? false : !!sourcemap,
          tsconfig: buildTSConfigPath,
          loaders: {
            cts: 'ts',
            ctsx: 'tsx',
            mts: 'ts',
            mtsx: 'tsx',
            cjs: 'js',
            cjsx: 'jsx',
            mjs: 'js',
            mjsx: 'jsx'
          },
          ...noTypeResolvedBuilderOptions,
          supported: {
            'import-attributes': features.keepImportAttributes !== false,
            ...resolvedBuilderOptions.supported
          }
        })
      )
      : import('rollup-plugin-swc3').then(({ default: swc }) =>
        swc({
          sourceMaps: typeof sourcemap === 'boolean'
            ? sourcemap
            : typeof sourcemap === 'undefined'
            ? undefined
            : ({
              hidden: false,
              inline: 'inline'
            } as const)[sourcemap] ?? undefined,
          tsconfig: buildTSConfigPath,
          ...noTypeResolvedBuilderOptions,
          jsc: {
            ...resolvedBuilderOptions.jsc,
            parser: resolvedBuilderOptions.jsc?.parser
              ? resolvedBuilderOptions.jsc?.parser
              : {
                syntax: 'typescript',
                tsx: true,
                decorators: true,
                dynamicImport: true
              },
            experimental: {
              ...resolvedBuilderOptions.jsc?.experimental,
              keepImportAttributes: features.keepImportAttributes !== false
            }
          }
        })
      )
    const [ana, anaOutputPlugin] = bundleAnalyzer(modules => void publishInEntry('modulesAnalyze', { modules }))
    const onlyOncePlugins = [
      anaOutputPlugin
    ]
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
          sourcemap,
          format,
          strict: typeof options?.output?.strict === 'object'
            ? options.output.strict.js
            : options?.output?.strict,
          externalImportAttributes: features.keepImportAttributes !== false,
          importAttributesKey: (
              features.keepImportAttributes === false
              || features.keepImportAttributes === undefined
            )
            ? undefined
            : features.keepImportAttributes === true
            ? 'with'
            : features.keepImportAttributes,
          plugins: []
        }, onlyOncePlugins)
      ],
      plugins: [
        ...commonPlugins,
        import('rollup-plugin-postcss')
          .then(({ default: postcss }) =>
            postcss({
              extract: resolve(output.replace(/\.[cm]?js$/, '.css')),
              minimize: true
            })
          )
          .catch(() => void 0),
        commonjs(),
        builder,
        // inject plugin can't resolve `import type`, so we should register it after the builder plugin
        inject({
          require: CREATE_REQUIRE_VIRTUAL_MODULE_NAME
        }),
        createRequire(format === 'esm'),
        ana,
        progress({
          onEvent: (event, message) => void publishInEntry('progress', { event, message, tags: ['js'] })
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
          dir: dtsOutdir,
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
        ...commonPlugins,
        skip({ patterns: [STYLE_REGEXP] }),
        dts({
          respectExternal: true,
          compilerOptions: {
            // temp directory, it not affect the output
            // but if the user not set it and `declaration`, inputs can't generate any dts files when the input relative imports of `package.json`
            outDir: 'dist',
            declaration: true,
            // https://github.com/Swatinem/rollup-plugin-dts/issues/143
            preserveSymlinks: false,
            // Expected '{', got 'type' (Note that you need plugins to import files that are not JavaScript)
            // https://github.com/Swatinem/rollup-plugin-dts/issues/96
            noEmit: false
          },
          tsconfig: dtsTSConfigPath
        }),
        progress({
          onEvent: (event, message) => void publishInEntry('progress', { event, message, tags: ['dts'] })
        }),
        dtsPlugins
      ]
    })
  }
  if (rollupOptions.length > 0) {
    // only push the first one a watcher plugin
    rollupOptions[0].plugins = [
      {
        name: 'jiek-plugin-watcher',
        watchChange: id => void publishInEntry('watchChange', { id })
      },
      ...(rollupOptions[0].plugins as Plugin[])
    ]
  }
  return rollupOptions
}

export function template(packageJSON: PackageJSON): RollupOptions[] {
  const { name, type, exports: entrypoints } = packageJSON
  const pkgIsModule = type === 'module'
  if (!name) throw new Error('package.json name is required')
  if (!entrypoints) throw new Error('package.json exports is required')

  const packageName = pascalCase(name)

  const external = externalResolver(packageJSON as Record<string, unknown>)

  const [filteredResolvedEntrypoints, exports] = getExports({
    entrypoints,
    pkgIsModule,
    entries,
    pkgName: JIEK_NAME!,
    outdir: jsOutdir,
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

      // eslint-disable-next-line ts/switch-exhaustiveness-check
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
  void publish('init', { leafMap, targetsLength: configs.length })
  return configs.map(c => ({
    ...COMMON_OPTIONS,
    ...c,
    plugins: [
      ...COMMON_PLUGINS,
      c.plugins
    ]
  }))
}
