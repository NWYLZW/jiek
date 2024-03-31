import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { pkger } from '@jiek/pkger'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import { filterPackagesFromDir } from '@pnpm/filter-workspace-packages'
import { program } from 'commander'
import { load } from 'js-yaml'

import { actionDone, actionRestore } from '../inner'

const FILE_TEMPLATE = (manifest: unknown) => `
module.exports = require('${
  process.env.NODE_ENV === 'test'
    ? 'jiek/src/rollup/index.ts'
    : 'jiek/rollup'
}').template({ }, ${JSON.stringify(manifest, null, 2)})
`.trimStart()

program
  .command('build')
  .option('--filter <filter>', 'filter packages')
  .option('--root <root>', 'root path')
  .action(async ({ root: rootOption, filter, ...options }: {
    root?: string
    filter?: string
  }) => {
    actionRestore()
    const root = rootOption
      ? path.isAbsolute(rootOption)
        ? rootOption
        : path.resolve(process.cwd(), rootOption)
      : process.cwd()
    const wd = getWorkspaceDir(root)
    const pnpmWorkspaceFilePath = path.resolve(wd, 'pnpm-workspace.yaml')
    const pnpmWorkspaceFileContent = fs.readFileSync(pnpmWorkspaceFilePath, 'utf-8')
    const pnpmWorkspace = load(pnpmWorkspaceFileContent) as {
      packages: string[]
    }
    if (root === wd && !filter) {
      throw new Error('root path is workspace root, please provide a filter')
      // TODO inquirer prompt support user select packages
    }
    if (root !== wd && !filter) {
      const packageJSONIsExist = fs.existsSync(path.resolve(root, 'package.json'))
      if (!packageJSONIsExist) {
        throw new Error('root path is not workspace root, please provide a filter')
      }
      const packageJSON = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'))
      if (!packageJSON.name) {
        throw new Error('root path is not workspace root, please provide a filter')
      }
      filter = packageJSON.name
    }
    const { selectedProjectsGraph } = await filterPackagesFromDir(wd, [{
      filter: filter ?? '',
      followProdDepsOnly: true
    }], {
      prefix: root,
      workspaceDir: wd,
      patterns: pnpmWorkspace.packages
    })
    const jiekTempDir = (...paths: string[]) => path.resolve(wd, 'node_modules/.jiek', ...paths)
    if (!fs.existsSync(jiekTempDir())) fs.mkdirSync(jiekTempDir())

    const rollupBinaryPath = require.resolve('rollup')
      .replace(/dist\/rollup.js$/, 'dist/bin/rollup')
    let i = 0
    for (const [dir, { package: { manifest } }] of Object.entries(selectedProjectsGraph)) {
      const newManifest = {
        ...manifest,
        ...pkger({ cwd: dir })
      }
      const escapeManifestName = manifest.name?.replace(/^@/g, '').replace(/\//g, '+')
      const configFile = jiekTempDir(
        `${escapeManifestName ?? `anonymous-${i++}`}.rollup.config.js`
      )
      fs.writeFileSync(configFile, FILE_TEMPLATE(newManifest))
      childProcess.execSync(`${
        process.env.NODE_ENV === 'test'
          ? 'node --import esbuild-register/loader -r esbuild-register '
          : ''
      }${rollupBinaryPath} -c ${configFile}`, {
        cwd: dir, stdio: 'inherit'
      })
    }

    actionDone()
  })
