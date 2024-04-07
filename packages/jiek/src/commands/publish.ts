import fs from 'node:fs'
import path from 'node:path'

import { bump, type BumperType } from '@jiek/utils/bumper'
import type { PackageJson } from '@npm/types'
import * as childProcess from 'child_process'
import { program } from 'commander'

import { actionDone, actionRestore } from '../inner'
import { mergePackageJson } from '../merge-package-json'
import { getSelectedProjectsGraph } from '../utils/filterSupport'

program
  .command('publish')
  .aliases(['pub', 'p'])
  .option('--bumper <bumper>', 'bump version', 'patch')
  .action(async ({ bumper, ...options }: {
    root?: string
    filter?: string
    bumper: BumperType
  }) => {
    actionRestore()

    const { value = {} } = await getSelectedProjectsGraph() ?? {}
    const selectedProjectsGraphEntries = Object.entries(value)
    if (selectedProjectsGraphEntries.length === 0) {
      throw new Error('no packages selected')
    }
    const mainfests: [dir: string, PackageJson][] = []
    selectedProjectsGraphEntries
      .forEach(([dir, manifest]) => {
        mainfests.push([
          dir, mergePackageJson(manifest, dir)
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
