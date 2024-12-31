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
import type { InputPluginOption, OutputOptions, OutputPlugin, OutputPluginOption, Plugin, RollupOptions } from 'rollup'
import ts from 'typescript'

import type { RollupBuildEntryCtx, RollupBuildEventMap } from '#~/bridge'
import { publish } from '#~/bridge'
import { bundleAnalyzer } from '#~/rollup/bundle-analyzer'
import { getInternalModuleName } from '#~/utils/getInternalModuleName'
import { intersection } from '#~/utils/intersection'
import { loadConfig } from '#~/utils/loadConfig'
import { recursiveListFiles } from '#~/utils/recursiveListFiles'
import { getOutDirs, resolveExports } from '#~/utils/resolveExports'
import { getCompilerOptionsByFilePath } from '#~/utils/ts'

import type { ConfigGenerateContext, TemplateOptions } from './base'
import createRequire, { CREATE_REQUIRE_VIRTUAL_MODULE_NAME } from './plugins/create-require'
import progress from './plugins/progress'
import skip from './plugins/skip'
import withExternal from './plugins/with-external.ts'
import type { PackageJSON } from './utils/externalResolver'
import externalResolver from './utils/externalResolver'

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
  JIEK_DTSCONFIG,
  JIEK_SKIP_JS,
  JIEK_FEATURES
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

const INTERNAL_MODULE_NAME = getInternalModuleName(JIEK_NAME!)

const WITHOUT_JS = JIEK_WITHOUT_JS === 'true'
const WITHOUT_DTS = JIEK_WITHOUT_DTS === 'true'
const WITHOUT_MINIFY = JIEK_WITHOUT_MINIFY === 'true'

const ONLY_MINIFY = JIEK_ONLY_MINIFY === 'true'

const CLEAN = JIEK_CLEAN === 'true'

const SKIP_JS = JIEK_SKIP_JS === 'false'
  ? false
  : JIEK_SKIP_JS === 'true'
  ? true
  : undefined

const FEATURES = JSON.parse(JIEK_FEATURES ?? '{}') as Record<string, unknown>

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
const {
  experimental,
  skipJS,
  build = {}
} = config
const { js: jsOutdir, dts: dtsOutdir } = getOutDirs({
  config,
  pkgName: JIEK_NAME
})

if (CLEAN) {
  fs.existsSync(jsOutdir) && fs.rmdirSync(jsOutdir, { recursive: true })
  fs.existsSync(dtsOutdir) && fs.rmdirSync(dtsOutdir, { recursive: true })
}

const STYLE_REGEXP = /\.(css|s[ac]ss|less|styl)$/

const CWD_FILES = recursiveListFiles(process.cwd())
  .filter(p => /(?<!\.d)\.[cm]?tsx?$/.test(p))
  .map(p => `./${relative(process.cwd(), p)}`)

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
  disableMinify?: boolean,
  onlyOncePlugins: OutputPluginOption[] = []
): OutputOptions[] => {
  const minify = disableMinify !== undefined
    ? !disableMinify
    : build?.output?.minify ?? MINIFY_DEFAULT_VALUE

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
            throw new TypeError('entryFileNames must be a function')
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
        chunkFileNames: chunkInfo =>
          typeof output.chunkFileNames === 'function'
            ? output.chunkFileNames(chunkInfo).replace(/(\.[cm]?js)$/, '.min$1')
            : (() => {
              throw new Error('chunkFileNames must be a function')
            })(),
        file: output.file?.replace(/(\.[cm]?js)$/, '.min$1'),
        plugins: [
          ...notOnlyOncePlugins,
          minifyPlugin
        ]
      }
    ]
}

interface GenerateConfigsOptions {
  internalModuleCollect?: (id: string) => void
  commonPlugins?: InputPluginOption[]
  disableDTS?: boolean
  disableMinify?: boolean
  disableCollectInternalModule?: boolean
}

const generateConfigs = (
  context: ConfigGenerateContext,
  {
    internalModuleCollect,
    commonPlugins: inputCommonPlugins = [],
    disableDTS = false,
    disableMinify,
    disableCollectInternalModule
  }: GenerateConfigsOptions = {}
): RollupOptions[] => {
  const buildOptions: TemplateOptions = build
  const {
    path,
    name,
    input,
    output,
    external: inputExternal,
    pkgIsModule,
    conditionals
  } = context
  const external = [...inputExternal, ...(buildOptions.external ?? []), ...(commandExternal ?? [])]
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
  const nodeResolvePluginInstance = nodeResolve({
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
  const reg = new RegExp(`^\./${
    input
      .slice(2)
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
  }$`)
  const inputObj = !input.includes('*')
    ? input
    : CWD_FILES.filter(p => reg.test(p))
  const globCommonDir = input.includes('*')
    ? input.split('*')[0]
    : ''
  const outputCommonDir = output.includes('*')
    ? output.split('*')[0]
    : ''
  if (
    (globCommonDir.length > 0 && outputCommonDir.length === 0)
    || (globCommonDir.length === 0 && outputCommonDir.length > 0)
  ) {
    throw new Error('input and path should both include "*" or not include "*"')
  }
  const jsOutputSuffix = extname(output)
  const tsOutputSuffix = jsOutputSuffix.replace(/(\.[cm]?)js$/, '.d$1ts')
  const { js: jsOutput, dts: dtsOutput } = resolveOutputControls(context, build.output)
  const rollupOptions: RollupOptions[] = []

  const commonPlugins: InputPluginOption[] = [
    ...inputCommonPlugins,
    withExternal(),
    !disableCollectInternalModule && {
      name: 'jiek:collect-internal-module',
      resolveId: {
        order: 'pre',
        async handler(source, importer, options) {
          if (!source.startsWith('#')) return

          if (!nodeResolvePluginInstance.resolveId || !('handler' in nodeResolvePluginInstance.resolveId)) {
            throw new Error('nodeResolvePluginInstance.resolveId is not a plugin instance')
          }
          let resolved = await nodeResolvePluginInstance
            .resolveId
            .handler
            .call(this, source, importer, options)
          if (typeof resolved === 'string') {
            resolved = { id: resolved }
          }
          if (!resolved || !('id' in resolved)) {
            throw new Error('nodeResolvePluginInstance.resolveId.handler did not return a resolved object')
          }
          internalModuleCollect?.(`./${relative(process.cwd(), resolved.id)}`)
          return {
            id: experimental?.importsDowngrade
              ? source
                .replaceAll('#', `${INTERNAL_MODULE_NAME}/`)
                .replaceAll('~', '+')
              : source,
            external: true
          }
        }
      }
    }
  ]
  const features = Object.assign(
    {
      keepImportAttributes: false
    },
    build.features,
    FEATURES
  )
  const importAttributesKey = (
      features.keepImportAttributes === false
      || features.keepImportAttributes === undefined
    )
    ? undefined
    : features.keepImportAttributes === true
    ? 'with'
    : features.keepImportAttributes
  if (jsOutput && !WITHOUT_JS) {
    const sourcemap = typeof buildOptions?.output?.sourcemap === 'object'
      ? buildOptions.output.sourcemap.js
      : buildOptions?.output?.sourcemap
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
            ...resolvedBuilderOptions.supported,
            'import-attributes': true
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
              keepImportAttributes: true
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
        ...withMinify(
          {
            dir: jsOutdir,
            name,
            interop: 'auto',
            entryFileNames: (chunkInfo) => {
              return Array.isArray(inputObj)
                ? chunkInfo.facadeModuleId!
                  .replace(`${process.cwd()}/`, './')
                  .replace(globCommonDir, outputCommonDir)
                  .replace(/(\.[cm]?)ts$/, jsOutputSuffix)
                  .replace(`${jsOutdir}/`, '')
                : output
                  .replace(`${jsOutdir}/`, '')
            },
            chunkFileNames: (chunkInfo) => {
              return `.internal/.chunks/${chunkInfo.name}.[hash]${jsOutputSuffix}`
            },
            sourcemap,
            format,
            strict: typeof buildOptions?.output?.strict === 'object'
              ? buildOptions.output.strict.js
              : buildOptions?.output?.strict,
            externalImportAttributes: features.keepImportAttributes === true
              ? true
              : features.keepImportAttributes,
            importAttributesKey
          },
          disableMinify,
          onlyOncePlugins
        )
      ],
      plugins: [
        ...commonPlugins,
        nodeResolvePluginInstance,
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
          sourceMap: sourcemap === 'hidden' ? false : !!sourcemap,
          modules: {
            ...build.injects ?? {},
            require: CREATE_REQUIRE_VIRTUAL_MODULE_NAME
          }
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

  if (!disableDTS && dtsOutput && !WITHOUT_DTS) {
    const sourcemap = typeof buildOptions?.output?.sourcemap === 'object'
      ? buildOptions.output.sourcemap.dts
      : buildOptions?.output?.sourcemap
    rollupOptions.push({
      input: inputObj,
      external,
      output: [
        {
          dir: dtsOutdir,
          sourcemap,
          entryFileNames: (chunkInfo) => (
            Array.isArray(inputObj)
              ? chunkInfo.facadeModuleId!
                .replace(`${process.cwd()}/`, './')
                .replace(globCommonDir, outputCommonDir)
                .replace(/(\.[cm]?)ts$/, tsOutputSuffix)
                .replace(`${jsOutdir}/`, '')
              : output
                .replace(/(\.[cm]?)js$/, tsOutputSuffix)
                .replace(`${jsOutdir}/`, '')
          ),
          strict: typeof buildOptions?.output?.strict === 'object'
            ? buildOptions.output.strict.dts
            : buildOptions?.output?.strict,
          externalImportAttributes: features.keepImportAttributes !== false,
          importAttributesKey
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
  const {
    name,
    type,
    bin,
    exports: entrypoints,
    imports: internalEntrypoints
  } = packageJSON
  const pkgIsModule = type === 'module'
  const packageName = pascalCase(name)
  const leafMap = new Map<string, string[][]>()
  const inputTags = new Map<string, string>()
  const inputExports = new Map<string, Record<string, unknown>>()
  const configs: RollupOptions[] = []
  const external = externalResolver(packageJSON)

  let collectConfigTotal = 0
  const collected = Promise.withResolvers<void>()
  const internalModules = new Set<string>()
  const internalModuleCollect = (id?: string) => {
    if (!id) return
    internalModules.add(id)
  }
  const collectPlugin: Plugin = {
    name: 'jiek:collect',
    buildStart() {
      collectConfigTotal++
    },
    buildEnd() {
      if (--collectConfigTotal === 0) {
        collected.resolve()
      }
    }
  }

  if (entrypoints) {
    const [filteredResolvedEntrypoints, exports] = resolveExports({
      entrypoints,
      pkgIsModule,
      entries,
      pkgName: JIEK_NAME!,
      outdir: jsOutdir,
      config,
      skipJS: skipJS ?? SKIP_JS
    })
    getAllLeafs(filteredResolvedEntrypoints as RecursiveRecord<string>, ({ keys, value }) => {
      if (typeof value === 'string') {
        const keysArr = leafMap.get(value) ?? []
        leafMap.set(value, keysArr)
        inputExports.set(value, exports)
        keysArr.push(keys)
      }
      return false
    })
  }
  if (bin) {
    ;[...new Set(typeof bin === 'string' ? [bin] : Object.values(bin))]
      .filter(binFile => binFile.startsWith('bin'))
      .map(binFile => [
        `./src/${binFile.replace(/(\.[cm]?)js$/, '$1ts')}`,
        `./dist/${binFile}`
      ])
      .forEach(([input, output]) => {
        configs.push(...generateConfigs({
          path: output,
          name,
          input,
          output,
          external,
          pkgIsModule,
          conditionals: output.endsWith('.mjs')
            ? ['import']
            : output.endsWith('.cjs')
            ? ['require']
            : []
        }, {
          internalModuleCollect,
          disableDTS: true,
          disableMinify: true,
          commonPlugins: [
            collectPlugin
          ]
        }))
        leafMap.set(input, [[output]])
        inputTags.set(input, 'binary')
      })
  }
  if (internalEntrypoints) {
    const [filteredResolvedInternalEntrypoints, imports] = resolveExports({
      entrypoints: internalEntrypoints,
      pkgIsModule,
      pkgName: JIEK_NAME!,
      outdir: `${jsOutdir}/.internal`,
      config,
      skipJS: SKIP_JS ?? skipJS
    })
    getAllLeafs(filteredResolvedInternalEntrypoints as RecursiveRecord<string>, ({ keys, value }) => {
      if (typeof value === 'string') {
        const keysArr = leafMap.get(value) ?? []
        leafMap.set(value, keysArr)
        inputExports.set(value, imports)
        inputTags.set(value, 'internal')
        keysArr.push(keys)
      }
      return false
    })
  }

  leafMap.forEach((keysArr, input) => {
    if (inputTags.get(input) === 'binary') return
    const isInternal = inputTags.get(input) === 'internal'
    const exports = inputExports.get(input)!

    keysArr.forEach((keys) => {
      const [path, ...conditionals] = keys

      const name = packageName + (path === '.' ? '' : pascalCase(path))
      const keyExports = reveal(exports, keys)
      const commonContext = {
        path,
        name,
        input,
        external,
        pkgIsModule
      }
      const commonOptions: GenerateConfigsOptions = isInternal
        ? {
          commonPlugins: [
            {
              name: 'jiek:loadInternalModules',
              async options(inputOptions) {
                await collected.promise
                inputOptions.input = [...intersection(
                  Array.isArray(inputOptions.input)
                    ? inputOptions.input
                    : [inputOptions.input as string],
                  internalModules
                )]
                if (inputOptions.input.length === 0) {
                  inputOptions.input = '__jiek_empty__'
                  const plugins = await inputOptions.plugins
                  if (!Array.isArray(plugins)) {
                    throw new TypeError('plugins is not an array')
                  }
                  inputOptions.plugins = plugins.filter(
                    p =>
                      typeof p !== 'object'
                        ? true
                        : p === null
                        ? true
                        : 'name' in p && p.name === 'jiek:loadInternalModules'
                  )
                }
                return inputOptions
              },
              resolveId: {
                order: 'post',
                handler(id) {
                  if (id === '__jiek_empty__') return id
                }
              },
              load: {
                order: 'post',
                handler(id) {
                  if (id === '__jiek_empty__') return ''
                }
              }
            }
          ],
          disableCollectInternalModule: true
        }
        : {
          internalModuleCollect,
          commonPlugins: [
            collectPlugin
          ]
        }

      // eslint-disable-next-line ts/switch-exhaustiveness-check
      switch (typeof keyExports) {
        case 'string': {
          configs.push(...generateConfigs({
            ...commonContext,
            output: keyExports,
            conditionals
          }, commonOptions))
          break
        }
        case 'object': {
          getAllLeafs(keyExports as RecursiveRecord<string>, ({ keys: nextKeys, value }) => {
            const allConditionals = [...new Set([...conditionals, ...nextKeys])]
            if (typeof value === 'string') {
              configs.push(...generateConfigs({
                ...commonContext,
                output: value,
                conditionals: allConditionals
              }, commonOptions))
            }
            return false
          })
          break
        }
      }
    })
  })

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
