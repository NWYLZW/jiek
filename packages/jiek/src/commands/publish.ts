import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { bump, type BumperType } from '@jiek/utils/bumper'
import { program } from 'commander'
import detectIndent from 'detect-indent'
import { applyEdits, modify } from 'jsonc-parser'

import { actionDone, actionRestore } from '../inner'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { getExports } from '../utils/getExports'
import { loadConfig } from '../utils/loadConfig'

program
  .command('publish')
  .aliases(['pub', 'p'])
  .option('-b, --bumper <bumper>', 'bump version', 'patch')
  .option('-p, --preview', 'preview publish')
  .action(async ({ preview, bumper, ...options }: {
    preview?: boolean
    bumper: BumperType
  }) => {
    actionRestore()

    const { value = {} } = await getSelectedProjectsGraph() ?? {}
    const selectedProjectsGraphEntries = Object.entries(value)
    if (selectedProjectsGraphEntries.length === 0) {
      throw new Error('no packages selected')
    }
    const mainfests = selectedProjectsGraphEntries
      .map(([dir, manifest]) => {
        const { type, exports: entrypoints = {} } = manifest
        const pkgIsModule = type === 'module'
        const newManifest = { ...manifest }
        const [, exports] = getExports({
          entrypoints,
          pkgIsModule,
          config: loadConfig(dir),
          dir
        })
        newManifest.exports = exports
        return [dir, newManifest] as const
      })
    const passArgs = Object
      .entries(options)
      .reduce((acc, [key, value]) => {
        if (value) {
          acc.push(`--${key}`, value as string)
        }
        return acc
      }, [] as string[])
    for (const [dir, manifest] of mainfests) {
      const oldJSONString = fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')
      const oldJSON = JSON.parse(oldJSONString) ?? '0.0.0'
      const newVersion = bump(oldJSON.version, bumper)
      // TODO detectIndent by editorconfig
      const { indent = '    ' } = detectIndent(oldJSONString)
      const formattingOptions = {
        tabSize: indent.length,
        insertSpaces: true
      }
      let newJSONString = oldJSONString
      newJSONString = applyEdits(newJSONString, modify(
        newJSONString, ['version'], newVersion, { formattingOptions }
      ))
      for (const [key, value] of Object.entries(manifest)) {
        if (JSON.stringify(value) === JSON.stringify(oldJSON[key])) continue

        if (key !== 'exports') {
          newJSONString = applyEdits(newJSONString, modify(
            newJSONString, ['publishConfig', key], value, { formattingOptions }
          ))
        } else {
          for (const [k, v] of Object.entries(value)) {
            newJSONString = applyEdits(newJSONString, modify(
              newJSONString, ['publishConfig', 'exports', k], v, { formattingOptions }
            ))
          }
        }
      }
      try {
        fs.renameSync(path.join(dir, 'package.json'), path.join(dir, 'package.json.bak'))
        fs.writeFileSync(path.join(dir, 'package.json'), newJSONString)
        console.log(newJSONString)
        if (preview) {
          console.warn('preview mode')
          continue
        }
        childProcess.execSync(['pnpm', 'publish', '--access', 'public', '--no-git-checks', ...passArgs].join(' '), {
          cwd: dir,
          stdio: 'inherit'
        })
        const modifyVersionPackageJSON = applyEdits(oldJSONString, modify(oldJSONString, ['version'], newVersion, {}))
        fs.writeFileSync(path.join(dir, 'package.json.bak'), modifyVersionPackageJSON)
      } finally {
        fs.unlinkSync(path.join(dir, 'package.json'))
        fs.renameSync(path.join(dir, 'package.json.bak'), path.join(dir, 'package.json'))
      }
    }
    actionDone()
  })
