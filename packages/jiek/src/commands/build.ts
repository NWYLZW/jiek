import '../rollup/base'

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { MultiBar, Presets } from 'cli-progress'
import { program } from 'commander'
import { execaCommand } from 'execa'

import { actionDone, actionRestore } from '../inner'
import type { RollupProgressEvent } from '../rollup/base'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { loadConfig } from '../utils/loadConfig'
import { tsRegisterName } from '../utils/tsRegister'

const FILE_TEMPLATE = (manifest: unknown) => (`
module.exports = require('jiek/rollup').template(${JSON.stringify(manifest, null, 2)})
`.trimStart())

const require = createRequire(import.meta.url)

program
  .command('build')
  .option('-s, --silent', "Don't display logs.")
  .option('-e, --entries <ENTRIES>', "Specify the entries of the package.json's 'exports' field.(support glob)")
  .option('-v, --verbose', 'Display debug logs.')
  .action(async ({
    silent,
    entries,
    verbose
  }: {
    silent: boolean
    entries: string
    verbose: boolean
  }) => {
    actionRestore()
    const { build } = loadConfig()
    silent = silent ?? build?.silent ?? false
    const {
      wd,
      value = {}
    } = await getSelectedProjectsGraph() ?? {}

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
    const multiBars = new MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '- {bar} | {status} | {input} | {message}'
    }, Presets.shades_classic)
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
        // TODO replace with `spawn` to support watch mode
        const command = `${prefix}${rollupBinaryPath} --silent -c ${configFile}`
        const child = execaCommand(command, {
          ipc: true,
          cwd: dir,
          env: {
            ...process.env,
            JIEK_ROOT: wd,
            JIEK_ENTRIES: entries
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
    ).finally(() => {
      multiBars.stop()
    })

    actionDone()
  })
