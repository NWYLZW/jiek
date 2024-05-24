import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'

import { actionDone, actionRestore } from '../inner'
import { mergePackageJson } from '../merge-package-json'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { tsRegisterName } from '../utils/tsRegister'

const FILE_TEMPLATE = (manifest: unknown) => `
const pkg = ${JSON.stringify(manifest, null, 2)}
const { jiek = {} } = pkg
const templateArg = jiek.templateArgFilePath
  ? require.resolve(jiek.templateArgFilePath)
  : {
    styled: jiek.styled
  }
module.exports = require('jiek/rollup').template(templateArg, pkg)
`.trimStart()

program
  .command('build')
  .action(async () => {
    actionRestore()
    const {
      wd, value = {}
    } = await getSelectedProjectsGraph() ?? {}

    if (Object.keys(value).length === 0) {
      throw new Error('no package found')
    }
    const jiekTempDir = (...paths: string[]) => path.resolve(wd, 'node_modules/.jiek', ...paths)
    if (!fs.existsSync(jiekTempDir())) fs.mkdirSync(jiekTempDir())

    const rollupBinaryPath = require.resolve('rollup')
      .replace(/dist\/rollup.js$/, 'dist/bin/rollup')
    let i = 0
    for (const [dir, manifest] of Object.entries(value)) {
      const newManifest = mergePackageJson(manifest, dir, { excludeDistInExports: true })
      // TODO support auto build child packages in workspaces
      const escapeManifestName = manifest.name?.replace(/^@/g, '').replace(/\//g, '+')
      const configFile = jiekTempDir(
        `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
      )
      fs.writeFileSync(configFile, FILE_TEMPLATE(newManifest))
      let prefix = ''
      if (tsRegisterName) {
        prefix = `node -r ${tsRegisterName} `
      }
      // TODO replace with `spawn` to support watch mode
      childProcess.execSync(`${prefix}${rollupBinaryPath} --silent -c ${configFile}`, {
        cwd: dir, stdio: 'inherit',
        env: {
          JIEK_ROOT: wd
        }
      })
    }

    actionDone()
  })
