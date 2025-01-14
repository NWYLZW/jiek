import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { MultiBar, Presets } from 'cli-progress'
import { program } from 'commander'
import { execaCommand } from 'execa'

import type { Config } from 'jiek'

import type { RollupBuildEvent } from '#~/bridge'
import type { AnalyzerBuildOptions } from '#~/commands/build/analyzer'
import { registerAnalyzerCommandOptions, useAnalyzer } from '#~/commands/build/analyzer'
import { entriesDescription, filtersDescription, outdirDescription } from '#~/commands/descriptions'
import { IS_WORKSPACE } from '#~/commands/meta'
import { parseBoolean } from '#~/commands/utils/optionParser'
import type { TemplateOptions } from '#~/rollup/base'
import { BUILDER_TYPES, BUILDER_TYPE_PACKAGE_NAME_MAP } from '#~/rollup/base'
import { createServer } from '#~/server'
import { checkDependency } from '#~/utils/checkDependency'
import type { Manifest } from '#~/utils/filterSupport'
import { filterPackagesGraph, getSelectedProjectsGraph } from '#~/utils/filterSupport'
import { getWD } from '#~/utils/getWD'
import { loadConfig } from '#~/utils/loadConfig'
import { tsRegisterName } from '#~/utils/tsRegister'

declare module 'jiek' {
  interface Config {
    /**
     * Skip entries which end with '.js'.
     */
    skipJS?: boolean
    build?: TemplateOptions & {
      /**
       * Whether to run in silent mode, only active when configured in the workspace root or cwd.
       *
       * @default false
       */
      silent?: boolean
    }
  }
}

interface BuildOptions extends
  AnalyzerBuildOptions,
  Pick<
    Config,
    'skipJS'
  >
{
  /**
   * Auto-detect the builder from the installed dependencies.
   * If the builder is not installed, it will prompt the user to install it.
   * If exists multiple builders, it will fall back to the 'esbuild'.
   */
  type?: typeof BUILDER_TYPES[number]
  /**
   * The output directory of the build, which relative to the target subpackage root directory.
   * Support with variables: 'PKG_NAME',
   * .e.g. 'dist/{{PKG_NAME}}'.
   *
   * @default 'dist'
   */
  outdir: string
  watch: boolean
  /**
   * The port of the server.
   *
   * @default 8888
   */
  port: number
  silent: boolean
  verbose: boolean
  entries?: string
  external?: string
  noConvert: boolean
  noJs: boolean
  noDts: boolean
  noMin: boolean
  /**
   * Do not clean the output directory before building.
   */
  noClean: boolean
  onlyMin: boolean
  /**
   * The type of minify, support 'terser' and 'builder'.
   *
   * @default 'builder'
   */
  minType?: string
  /**
   * The path of the tsconfig file which is used to generate js and dts files.
   * If not specified, it will be loaded from:
   * - ./tsconfig.json
   * - ./tsconfig.dts.json
   * - ./tsconfig.build.json
   */
  tsconfig?: string
  /**
   * The path of the tsconfig file which is used to generate dts files.
   * If not specified, it will be loaded from:
   * - ./tsconfig.json
   * - ./tsconfig.dts.json
   */
  dtsconfig?: string

  'features.keepImportAttributes'?: boolean | 'assert'
}

async function action(filtersOrEntries: string | undefined, options: BuildOptions) {
  const FILE_TEMPLATE = (manifest: unknown) =>
    `module.exports = require('jiek/rollup').template(${JSON.stringify(manifest, null, 2)})`

  const ROLLUP_BIN = require
    .resolve('rollup')
    .replace(/dist\/rollup.js$/, 'dist/bin/rollup')

  let DEFAULT_BUILDER_TYPE: typeof BUILDER_TYPES[number]
  Object.entries(BUILDER_TYPE_PACKAGE_NAME_MAP).forEach(([type, packageName]) => {
    try {
      require.resolve(packageName)
      DEFAULT_BUILDER_TYPE = type as typeof BUILDER_TYPES[number]
    } catch { /* empty */ }
  })
  if (!DEFAULT_BUILDER_TYPE!) {
    DEFAULT_BUILDER_TYPE = 'esbuild'
  }

  let {
    type,
    outdir,
    watch,
    silent,
    verbose,
    entries: optionEntries,
    external,
    noConvert,
    noJs: withoutJs,
    noDts: withoutDts,
    noMin: withoutMin,
    minType: minifyType,
    noClean,
    onlyMin,
    tsconfig,
    dtsconfig,
    skipJS
  } = options
  const resolvedType = type ?? DEFAULT_BUILDER_TYPE
  if (!withoutJs) {
    await checkDependency(BUILDER_TYPE_PACKAGE_NAME_MAP[resolvedType])
    if (minifyType === 'builder') {
      minifyType = resolvedType
    }
  }
  if (!withoutMin && minifyType === 'terser') {
    await checkDependency('@rollup/plugin-terser')
  }
  let shouldPassThrough = false

  const passThroughOptions = process.argv
    .reduce(
      (acc, value) => {
        if (shouldPassThrough) {
          acc.push(value)
        }
        if (value === '--') {
          shouldPassThrough = true
        }
        return acc
      },
      [] as string[]
    )

  const shouldCreateServer = [
    options.ana === true && options['ana.mode'] === 'server'
  ].some(Boolean)
  const server = shouldCreateServer
    ? createServer(options.port, 'localhost')
    : undefined

  const {
    ANALYZER_ENV,
    refreshAnalyzer
  } = await useAnalyzer(options, server)

  const { build } = loadConfig()
  silent = silent ?? build?.silent ?? false

  if (withoutMin && onlyMin) {
    throw new Error('Cannot use both --without-minify and --only-minify')
  }
  if (onlyMin && withoutJs) {
    throw new Error('Cannot use --without-js and --only-minify at the same time')
  }

  let entries: string | undefined = [
    optionEntries,
    IS_WORKSPACE ? undefined : filtersOrEntries
  ].filter(Boolean).join(',')
  if (entries.length === 0) {
    entries = undefined
  }
  const env = {
    ...ANALYZER_ENV,
    JIEK_BUILDER: type,
    JIEK_OUT_DIR: outdir,
    JIEK_CLEAN: String(!noClean),
    JIEK_ENTRIES: entries,
    JIEK_EXTERNAL: external,
    JIEK_CROSS_MODULE_CONVERTOR: String(!noConvert),
    JIEK_WITHOUT_JS: String(withoutJs),
    JIEK_WITHOUT_DTS: String(withoutDts),
    JIEK_WITHOUT_MINIFY: String(withoutMin),
    JIEK_ONLY_MINIFY: String(onlyMin),
    JIEK_MINIFY_TYPE: minifyType,
    JIEK_TSCONFIG: tsconfig,
    JIEK_DTSCONFIG: dtsconfig,
    JIEK_SKIP_JS: String(skipJS),
    JIEK_FEATURES: JSON.stringify({
      keepImportAttributes: options['features.keepImportAttributes']
    }),
    ...process.env
  }

  const multiBars = new MultiBar({
    hideCursor: true,
    format: '- {pkgName} | {status} | {input} | {message}'
  }, Presets.shades_classic)

  const { wd } = getWD()
  const wdNodeModules = path.resolve(wd, 'node_modules')
  if (!existsSync(wdNodeModules)) {
    mkdirSync(wdNodeModules)
  }
  const resolveByJiekTemp = (...paths: string[]) => path.resolve(wdNodeModules, '.jiek', ...paths)
  const jiekTemp = resolveByJiekTemp()
  if (!existsSync(jiekTemp)) {
    try {
      mkdirSync(jiekTemp)
    } catch (e) {
      if ((e as { code: string }).code !== 'EEXIST') {
        throw e
      }
    }
  }

  let i = 0
  const buildPackage = async ([pkgCWD, manifest]: [
    string,
    Manifest
  ], {
    resolveByJiekTemp
  }: {
    resolveByJiekTemp: (...paths: string[]) => string
  }) => {
    if (manifest.name == null) {
      throw new Error('package.json must have a name field')
    }

    // TODO support auto build child packages in workspaces
    const escapeManifestName = manifest.name.replace(/^@/g, '').replace(/\//g, '+')
    const configFile = resolveByJiekTemp(
      `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
    )
    writeFileSync(configFile, FILE_TEMPLATE(manifest))
    const command = [ROLLUP_BIN, '--silent', '-c', configFile]
    if (tsRegisterName != null) {
      command.unshift(`node -r ${tsRegisterName}`)
    }
    if (watch) {
      command.push('--watch')
    }
    command.push(...passThroughOptions)
    const child = execaCommand(command.join(' '), {
      ipc: true,
      cwd: pkgCWD,
      windowsHide: true,
      env: {
        ...env,
        JIEK_NAME: manifest.name,
        JIEK_ROOT: wd
      }
    })
    const bars: Record<string, ReturnType<typeof multiBars.create>> = {}
    const times: Record<string, number> = {}
    const locks: Record<string, boolean> = {}
    let inputMaxLen = 10
    child.on('message', (e: RollupBuildEvent) => {
      if (
        silent && [
          'init',
          'progress',
          'watchChange'
        ].includes(e.type)
      ) return
      switch (e.type) {
        case 'init': {
          const { leafMap, targetsLength } = e.data
          const leafs = Array
            .from(leafMap.entries())
            .flatMap(([input, pathAndConditions]) =>
              pathAndConditions.map(([path, ...conditions]) => ({
                input,
                path,
                conditions
              }))
            )
          let initMessage = `Package '${manifest.name}' has ${targetsLength} targets to build`
          if (watch) {
            initMessage += ' and watching...'
          }
          // eslint-disable-next-line no-console
          console.log(initMessage)
          leafs.forEach(({ input }) => {
            inputMaxLen = Math.max(inputMaxLen, input.length)
          })
          leafs.forEach(({ input, path }) => {
            const key = `${input}:${path}`
            // eslint-disable-next-line ts/strict-boolean-expressions
            if (bars[key]) return
            bars[key] = multiBars.create(0, 0, {
              pkgName: manifest.name,
              input: input.padEnd(inputMaxLen + 5),
              status: 'waiting'.padEnd(10)
            }, {
              linewrap: true
            })
          })
          break
        }
        case 'progress': {
          const {
            path,
            tags,
            input,
            event,
            message
          } = e.data
          const bar = bars[`${input}:${path}`]
          // eslint-disable-next-line ts/strict-boolean-expressions
          if (!bar) return
          const time = times[`${input}:${path}`]
          bar.update(0, {
            input: (
              time
                ? `${input}(x${time.toString().padStart(2, '0')})`
                : input
            ).padEnd(inputMaxLen + 5),
            status: event?.padEnd(10),
            message: `${tags?.join(', ')}: ${message}`
          })
          break
        }
        case 'watchChange': {
          const {
            path,
            input
          } = e.data
          const key = `${input}:${path}`
          const bar = bars[key]
          // eslint-disable-next-line ts/strict-boolean-expressions
          if (!bar) return
          let time = times[key] ?? 1
          if (!locks[key]) {
            time += 1
            times[key] = time
            setTimeout(() => {
              locks[key] = false
            }, 100)
            bar.update(0, {
              input: `${input}(x${time.toString().padStart(2, '0')})`.padEnd(inputMaxLen + 5),
              status: 'watching'.padEnd(10),
              message: 'watching...'
            })
          }
          locks[key] = true
          break
        }
        case 'modulesAnalyze': {
          const {
            data: {
              type,
              modules: pkgModules
            }
          } = e
          void refreshAnalyzer(
            pkgCWD,
            pkgModules.map(m => ({
              ...m,
              type,
              filename: `${manifest.name}/${m.filename}`,
              label: `${manifest.name}/${m.label}`
            }))
          )
          break
        }
        case 'debug': {
          // eslint-disable-next-line no-console,ts/no-unsafe-argument
          console.log(...(Array.isArray(e.data) ? e.data : [e.data]))
          break
        }
        default:
      }
    })
    await new Promise<void>((resolve, reject) => {
      let errorStr = `rollup build failed\n`
        + `package name: ${manifest.name}\n`
        + `cwd: ${pkgCWD}\n\n`
      child.stderr?.on('data', (data) => {
        errorStr += data
      })
      child.once('exit', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(errorStr)))
      verbose && child.stdout?.pipe(process.stdout)
    })
  }

  const commandFilters = IS_WORKSPACE ? filtersOrEntries : undefined
  const filters = [
    ...new Set([
      ...(program.getOptionValue('filter') as string | undefined)
        ?.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        ?? [],
      ...commandFilters
        ?.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        ?? []
    ])
  ]
  try {
    const packages = (
      filters.length > 0
        ? await filterPackagesGraph(filters)
        : [await getSelectedProjectsGraph()]
    ).flatMap(({ value }) => Object.entries(value ?? {}))
    await Promise.allSettled(
      packages.map(async ([cwd, manifest]) => buildPackage([cwd, manifest], { resolveByJiekTemp }))
    )
  } finally {
    multiBars.stop()
    // eslint-disable-next-line no-console
    !silent && console.log('Build complete')
  }
}

function registerCommand() {
  let command = process.env.JIEK_BIN__FILENAME === 'build.cjs'
    ? (() => {
      const c = program
        .name('jb/jiek-build')
        .helpCommand(false)
      if (IS_WORKSPACE) {
        c.argument(
          '[filters]',
          `${filtersDescription}\nIf you pass the --filter option, it will merge into the filters of the command.`
        )
      } else {
        c.argument(
          '[entries]',
          `${entriesDescription}\nIf you pass the --entries option, it will merge into the entries of the command.`
        )
      }
      return c
    })()
    : program
      .command(`build [${IS_WORKSPACE ? 'filters' : 'entries'}]`)

  command = command
    .description(`
Build the package according to the 'exports' field from the package.json.
If you want to through the options to the \`rollup\` command, you can pass the options after '--'.
`.trim())
    .option('-t, --type <TYPE>', `The type of build, support ${BUILDER_TYPES.map(s => `"${s}"`).join(', ')}.`, v => {
      if (!BUILDER_TYPES.includes(v as typeof BUILDER_TYPES[number])) {
        throw new Error(`The value of 'type' must be ${BUILDER_TYPES.map(s => `"${s}"`).join(', ')}`)
      }
      return String(v)
    }, 'esbuild')
    .option('-o, --outdir <OUTDIR>', outdirDescription, String, 'dist')
    .option('-e, --entries <ENTRIES>', entriesDescription)
    .option('--external <EXTERNAL>', 'Specify the external dependencies of the package.', String)
    .option('--noConvert', 'Specify the `crossModuleConvertor` option to false.', parseBoolean)
    .option('-nj, --noJs', 'Do not output js files.', parseBoolean)
    .option('-nd, --noDts', 'Do not output dts files.', parseBoolean)
    .option('-nm, --noMin', 'Do not output minify files.', parseBoolean)
    .option(
      '--minType <MINTYPE>',
      'The type of minify, support "builder" and "terser".',
      v => {
        if (!['builder', 'terser'].includes(v)) {
          throw new Error('The value of `minType` must be "builder" or "terser"')
        }
        return String(v)
      }
    )
    .option('-nc, --noClean', 'Do not clean the output directory before building.', parseBoolean)
    .option(
      '-om, --onlyMin',
      'Only output minify files, but dts files will still be output, it only replaces the js files.',
      parseBoolean
    )

  command = command
    .option('--skipJS', 'Skip entries which end with ".js".', parseBoolean)

  command = command
    .option('--features.keepImportAttributes', 'Keep the import attributes in the output.')

  command = command
    .option(
      '--tsconfig <TSCONFIG>',
      'The path of the tsconfig file which is used to generate js and dts files.',
      String
    )
    .option('--dtsconfig <DTSCONFIG>', 'The path of the tsconfig file which is used to generate dts files.', String)

  command = command
    .option('-w, --watch', 'Watch the file changes.', parseBoolean)
    .option('-p, --port <PORT>', 'The port of the server.', Number.parseInt, 8888)

  command = registerAnalyzerCommandOptions(command)

  command = command
    .option('-s, --silent', "Don't display logs.", parseBoolean)
    .option('-v, --verbose', 'Display debug logs.', parseBoolean)

  command.action(action)
}

registerCommand()
