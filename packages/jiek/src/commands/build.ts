import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { MultiBar, Presets } from 'cli-progress'
import { program } from 'commander'
import { execaCommand } from 'execa'

import { actionDone, actionRestore } from '../inner'
import type { RollupProgressEvent, TemplateOptions } from '../rollup/base'
import type { ProjectsGraph } from '../utils/filterSupport'
import { filterPackagesGraph, getSelectedProjectsGraph } from '../utils/filterSupport'
import { loadConfig } from '../utils/loadConfig'
import { tsRegisterName } from '../utils/tsRegister'
import { outdirDescription } from './descriptions'

declare module 'jiek' {
  export interface Config {
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

const FILE_TEMPLATE = (manifest: unknown) => (`
module.exports = require('jiek/rollup').template(${JSON.stringify(manifest, null, 2)})
`.trimStart())

const require = createRequire(import.meta.url)

const description = `
Build the package according to the 'exports' field in the package.json.
If you want to rewrite the rollup command options, you can pass the options after '--'.
e.g. \`jiek build -- --watch\`
`.trim()

interface BuildOptions extends Record<string, unknown> {
  /**
   * The output directory of the build, which relative to the target subpackage root directory.
   * Support with variables: 'PKG_NAME',
   * .e.g. 'dist/{{PKG_NAME}}'.
   *
   * @default 'dist'
   */
  outdir: string
  silent: boolean
  entries: string
  verbose: boolean
  noJs: boolean
  noDts: boolean
  noMin: boolean
  /**
   * Do not clean the output directory before building.
   */
  noClean: boolean
  onlyMin: boolean
}

function parseBoolean(v?: unknown) {
  if (v === undefined) return true
  return Boolean(v)
}

program
  .command('build')
  .description(description)
  .option('-o, --outdir <OUTDIR>', outdirDescription, String, 'dist')
  .option('-e, --entries <ENTRIES>', "Specify the entries of the package.json's 'exports' field.(support glob)")
  .option('-nj, --noJs', 'Do not output js files.', parseBoolean)
  .option('-nd, --noDts', 'Do not output dts files.', parseBoolean)
  .option('-nm, --noMin', 'Do not output minify files.', parseBoolean)
  .option('-nc, --noClean', 'Do not clean the output directory before building.', parseBoolean)
  .option(
    '-om, --onlyMin',
    'Only output minify files, but dts files will still be output, it only replaces the js files.',
    parseBoolean
  )
  .option('-s, --silent', "Don't display logs.", parseBoolean)
  .option('-v, --verbose', 'Display debug logs.', parseBoolean)
  .action(async ({
    outdir,
    silent,
    entries,
    verbose,
    noJs: withoutJs,
    noDts: withoutDts,
    noMin: withoutMin,
    noClean,
    onlyMin: onlyMin
  }: BuildOptions) => {
    let shouldPassThrough = false

    const passThroughOptions = program
      .parseOptions(process.argv)
      .unknown
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
    actionRestore()
    const { build } = loadConfig()
    silent = silent ?? build?.silent ?? false

    if (withoutMin && onlyMin) {
      throw new Error('Cannot use both --without-minify and --only-minify')
    }
    if (onlyMin && withoutJs) {
      throw new Error('Cannot use --without-js and --only-minify at the same time')
    }

    const env = {
      ...process.env,
      JIEK_OUT_DIR: outdir,
      JIEK_CLEAN: String(!noClean),
      JIEK_ENTRIES: entries,
      JIEK_WITHOUT_JS: String(withoutJs),
      JIEK_WITHOUT_DTS: String(withoutDts),
      JIEK_WITHOUT_MINIFY: String(withoutMin),
      JIEK_ONLY_MINIFY: String(onlyMin)
    }

    const multiBars = new MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '- {bar} | {status} | {pkgName} | {input} | {message}'
    }, Presets.shades_classic)

    const buildPackage = async ({
      wd,
      value = {}
    }: ProjectsGraph) => {
      if (Object.keys(value).length === 0) {
        throw new Error('no package found')
      }
      const wdNodeModules = path.resolve(wd, 'node_modules')
      if (!fs.existsSync(wdNodeModules)) {
        fs.mkdirSync(wdNodeModules)
      }
      const jiekTempDir = (...paths: string[]) => path.resolve(wdNodeModules, '.jiek', ...paths)
      if (!fs.existsSync(jiekTempDir())) {
        fs.mkdirSync(jiekTempDir())
      }

      const rollupBinaryPath = require.resolve('rollup')
        .replace(/dist\/rollup.js$/, 'dist/bin/rollup')
      let i = 0
      await Promise.all(
        Object.entries(value).map(async ([dir, manifest]) => {
          if (!manifest.name) {
            throw new Error('package.json must have a name field')
          }

          // TODO support auto build child packages in workspaces
          const escapeManifestName = manifest.name.replace(/^@/g, '').replace(/\//g, '+')
          const configFile = jiekTempDir(
            `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
          )
          fs.writeFileSync(configFile, FILE_TEMPLATE(manifest))
          let prefix = ''
          if (tsRegisterName) {
            prefix = `node -r ${tsRegisterName} `
          }
          const command = [`${prefix}${rollupBinaryPath} --silent -c ${configFile}`, ...passThroughOptions].join(' ')
          const child = execaCommand(command, {
            ipc: true,
            cwd: dir,
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
          child.on('message', (e: RollupProgressEvent) => {
            if (e.type === 'debug') console.log(...(Array.isArray(e.data) ? e.data : [e.data]))
          })
          !silent && child.on('message', (e: RollupProgressEvent) => {
            if (e.type === 'init') {
              const { leafMap, targetsLength } = e.data
              const leafs = Array
                .from(leafMap.entries())
                .flatMap(([input, pathAndCondiions]) =>
                  pathAndCondiions.map(([path, ...conditions]) => ({
                    input,
                    path,
                    conditions
                  }))
                )
              console.log(`Package '${manifest.name}' has ${targetsLength} targets to build`)
              leafs.forEach(({ input }) => {
                inputMaxLen = Math.max(inputMaxLen, input.length)
              })
              leafs.forEach(({ input, path }) => {
                const key = `${input}:${path}`
                if (bars[key]) return
                bars[key] = multiBars.create(50, 0, {
                  pkgName: manifest.name,
                  input: input.padEnd(inputMaxLen + 5),
                  status: 'waiting'.padEnd(10)
                }, {
                  barsize: 20,
                  linewrap: true
                })
              })
            }
            if (e.type === 'progress') {
              const {
                path,
                tags,
                input,
                event,
                message
              } = e.data
              const bar = bars[`${input}:${path}`]
              if (!bar) return
              const time = times[`${input}:${path}`]
              bar.update(
                {
                  start: 0,
                  resolve: 20,
                  end: 50
                }[event ?? 'start'] ?? 0,
                {
                  input: (
                    time
                      ? `${input}(x${time.toString().padStart(2, '0')})`
                      : input
                  ).padEnd(inputMaxLen + 5),
                  status: event?.padEnd(10),
                  message: `${tags?.join(', ')}: ${message}`
                }
              )
            }
            if (e.type === 'watchChange') {
              const {
                path,
                input
              } = e.data
              const key = `${input}:${path}`
              const bar = bars[key]
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
            }
          })
          await new Promise<void>((resolve, reject) => {
            let errorStr = ''
            child.stderr?.on('data', (data) => {
              errorStr += data
            })
            child.once('exit', (code) =>
              code === 0
                ? resolve()
                : reject(new Error(`rollup build failed:\n${errorStr}`)))
            verbose && child.stdout?.pipe(process.stdout)
          })
        })
      )
    }
    const filters = (program.getOptionValue('filter') as string | undefined)?.split(',')
    try {
      if (filters) {
        const packages = await filterPackagesGraph(filters)
        await Promise.all(packages.map(buildPackage))
      } else {
        await buildPackage(await getSelectedProjectsGraph())
      }
    } finally {
      multiBars.stop()
    }

    actionDone()
  })
