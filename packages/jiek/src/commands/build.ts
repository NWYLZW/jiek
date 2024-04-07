import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'

import { actionDone, actionRestore } from '../inner'
import { mergePackageJson } from '../merge-package-json'
import { getSelectedProjectsGraph } from '../utils/filterSupport'

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
      const newManifest = mergePackageJson(manifest, dir)
      // TODO support auto build child packages in workspaces
      const escapeManifestName = manifest.name?.replace(/^@/g, '').replace(/\//g, '+')
      const configFile = jiekTempDir(
        `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
      )
      fs.writeFileSync(configFile, FILE_TEMPLATE(newManifest))
      let prefix = ''
      if (process.env.NODE_ENV === 'test') {
        const registerPath = require.resolve('esbuild-register')
        const loaderPath = require.resolve('esbuild-register/loader')
        prefix = `node --import ${registerPath} -r ${loaderPath} `
      }
      // TODO replace with `spawn` to support watch mode
      childProcess.execSync(`${prefix}${rollupBinaryPath} -c ${configFile}`, {
        cwd: dir, stdio: 'inherit'
      })
    }

    actionDone()
  })
