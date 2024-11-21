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
`.trim()

interface BuildOptions {
  silent: boolean
  entries: string
  verbose: boolean
  withoutJs: boolean
  withoutDts: boolean
  withoutMinify: boolean
  onlyMinify: boolean
}

program
  .command('build')
  .description(description)
  .option('-s, --silent', "Don't display logs.")
  .option('-e, --entries <ENTRIES>', "Specify the entries of the package.json's 'exports' field.(support glob)")
  .option('--without-js', 'Do not output js files.')
  .option('--without-dts', 'Do not output dts files.')
  .option('--without-minify', 'Do not output minify files.')
  .option(
    '--only-minify',
    'Only output minify files, but dts files will still be output, it only replaces the js files.'
  )
  .option('-v, --verbose', 'Display debug logs.')
  .action(async ({
    silent,
    entries,
    verbose,
    withoutJs,
    withoutDts,
    withoutMinify,
    onlyMinify
  }: BuildOptions) => {
    actionRestore()
    const { build } = loadConfig()
    silent = silent ?? build?.silent ?? false

    if (withoutMinify && onlyMinify) {
      throw new Error('Cannot use both --without-minify and --only-minify')
    }
    if (onlyMinify && withoutJs) {
      throw new Error('Cannot use --without-js and --only-minify at the same time')
    }

    const env = {
      ...process.env,
      JIEK_ENTRIES: entries,
      JIEK_WITHOUT_JS: String(withoutJs),
      JIEK_WITHOUT_DTS: String(withoutDts),
      JIEK_WITHOUT_MINIFY: String(withoutMinify),
      JIEK_ONLY_MINIFY: String(onlyMinify)
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
          // TODO support auto build child packages in workspaces
          const escapeManifestName = manifest.name?.replace(/^@/g, '').replace(/\//g, '+')
          const configFile = jiekTempDir(
            `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
          )
          fs.writeFileSync(configFile, FILE_TEMPLATE(manifest))
          let prefix = ''
          if (tsRegisterName) {
            prefix = `node -r ${tsRegisterName} `
          }
          const command = `${prefix}${rollupBinaryPath} --silent -c ${configFile}`
          const child = execaCommand(command, {
            ipc: true,
            cwd: dir,
            env: {
              ...env,
              JIEK_ROOT: wd
            }
          })
          const bars: Record<string, ReturnType<typeof multiBars.create>> = {}
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
                  input: input.padEnd(inputMaxLen),
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
              bar.update(
                {
                  start: 0,
                  resolve: 20,
                  end: 50
                }[event ?? 'start'] ?? 0,
                {
                  input: input.padEnd(inputMaxLen),
                  status: event?.padEnd(10),
                  message: `${tags?.join(', ')}: ${message}`
                }
              )
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
