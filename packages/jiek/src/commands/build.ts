import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'
import { execaCommand } from 'execa'

import { actionDone, actionRestore } from '../inner'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { tsRegisterName } from '../utils/tsRegister'

const FILE_TEMPLATE = (manifest: unknown) =>
  `const pkg = ${JSON.stringify(manifest, null, 2)}
const { jiek = {} } = pkg
const templateArg = jiek.templateArgFilePath
  ? require.resolve(jiek.templateArgFilePath)
  : {
    styled: jiek.styled
  }
module.exports = require('jiek/rollup.v2').template(pkg, templateArg)
`.trimStart()

program
  .command('build')
  .option('-t, --target <type>', 'target flow: esm|umd|dts, default esm,umd,dts')
  .option('-s, --silent', 'silent mode')
  .action(async ({ target, silent }) => {
    actionRestore()
    const {
      wd,
      value = {}
    } = await getSelectedProjectsGraph() ?? {}

    if (Object.keys(value).length === 0) {
      throw new Error('no package found')
    }
    const jiekTempDir = (...paths: string[]) => path.resolve(wd, 'node_modules/.jiek', ...paths)
    if (!fs.existsSync(jiekTempDir())) fs.mkdirSync(jiekTempDir())

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
        // TODO replace with `spawn` to support watch mode
        const command = `${prefix}${rollupBinaryPath} --silent -c ${configFile}`
        const child = execaCommand(command, {
          cwd: dir,
          env: {
            ...process.env,
            JIEK_TARGET: target ?? process.env.JIEK_TARGET ?? 'esm,umd,dts',
            JIEK_SILENT: `${silent}` ?? process.env.JIEK_SILENT,
            JIEK_ROOT: wd
          }
        })
        child.on('message', console.log)
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
    )

    actionDone()
  })
