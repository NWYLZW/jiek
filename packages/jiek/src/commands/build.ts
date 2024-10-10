import fs from 'node:fs'
import path from 'node:path'

import { MultiBar, Presets } from 'cli-progress'
import { program } from 'commander'
import { execaCommand } from 'execa'

import { actionDone, actionRestore } from '../inner'
import type { RollupProgressEvent, TemplateOptions } from '../rollup/base'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
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
const manifest = ${JSON.stringify(manifest, null, 2)}
module.exports = require('jiek/rollup').template(manifest)
`.trimStart())

program
  .command('build')
  .option('-s, --silent', 'silent mode')
  .action(async ({ silent }) => {
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
            JIEK_SILENT: `${silent}` ?? process.env.JIEK_SILENT,
            JIEK_ROOT: wd
          }
        })
        const bars: Record<string, ReturnType<typeof multiBars.create>> = {}
        let inputMaxLen = 10
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
          if (e.type === 'debug') console.log(e.data)
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
              : reject(new Error(`rollup build failed: ${errorStr}`)))
        })
      })
    ).finally(() => {
      multiBars.stop()
    })

    actionDone()
  })
