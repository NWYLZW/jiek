import fs from 'node:fs'
import path from 'node:path'

import { pkger } from '@jiek/pkger'
import type { PackageJson } from '@npm/types'
import { filterPackagesFromDir } from '@pnpm/filter-workspace-packages'
import * as childProcess from 'child_process'
import { program } from 'commander'

import { actionDone, actionRestore } from '../inner'
import { bump, type BumperType } from '../utils/bumper'
import { getWorkspaceDir } from '../utils/getWorkspaceDir'

program
  .command('publish')
  .aliases(['pub', 'p'])
  .option('--filter <filter>', 'filter packages')
  .option('--root <root>', 'root path')
  .option('--bumper <bumper>', 'bump version', 'patch')
  .action(async ({ root: rootOption, filter, bumper, ...options }: {
    root?: string
    filter?: string
    bumper: BumperType
  }) => {
    actionRestore()
    const root = rootOption
      ? path.isAbsolute(rootOption)
        ? rootOption
        : path.resolve(process.cwd(), rootOption)
      : process.cwd()
    const wd = getWorkspaceDir(root)
    const { selectedProjectsGraph } = await filterPackagesFromDir(wd, [{
      filter: filter ?? '',
      followProdDepsOnly: true
    }], {
      prefix: root,
      workspaceDir: wd,
      patterns: ['packages/*']
    })
    const mainfests: [dir: string, PackageJson][] = []
    Object
      .entries(selectedProjectsGraph)
      .forEach(([, { package: { dir, manifest } }]) => {
        mainfests.push([
          dir, {
            ...manifest,
            ...pkger({
              cwd: dir
            })
          } as PackageJson
        ])
      })
    const passArgs = Object
      .entries(options)
      .reduce((acc, [key, value]) => {
        if (value) {
          acc.push(`--${key}`, value as string)
        }
        return acc
      }, [] as string[])
    for (const [dir, m] of mainfests) {
      const newVersion = bump(m.version, bumper)
      const newManifest = {
        ...m,
        version: newVersion
      }
      fs.renameSync(path.join(dir, 'package.json'), path.join(dir, 'package.json.bak'))
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(newManifest, null, 2))
      console.log(newManifest)
      try {
        childProcess.execSync(['pnpm', 'publish', '--access', 'public', '--no-git-checks', ...passArgs].join(' '), {
          cwd: dir,
          stdio: 'inherit'
        })
        const oldPackageJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json.bak'), 'utf-8'))
        oldPackageJson.version = newVersion
        fs.writeFileSync(path.join(dir, 'package.json.bak'), JSON.stringify(oldPackageJson, null, 2))
      } finally {
        fs.unlinkSync(path.join(dir, 'package.json'))
        fs.renameSync(path.join(dir, 'package.json.bak'), path.join(dir, 'package.json'))
      }
    }
    actionDone()
  })
