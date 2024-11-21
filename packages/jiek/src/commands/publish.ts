import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { bump, type BumperType, TAGS } from '@jiek/utils/bumper'
import { program } from 'commander'
import detectIndent from 'detect-indent'
import { applyEdits, modify } from 'jsonc-parser'

import { actionDone, actionRestore } from '../inner'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { getExports } from '../utils/getExports'
import { loadConfig } from '../utils/loadConfig'

declare module 'jiek' {
  export interface Config {
    publish?: {
      /**
       * @default false
       */
      withSuffix?: boolean
      /**
       * @default true
       */
      withSource?: boolean
    }
  }
}

program
  .command('publish')
  .aliases(['pub', 'p'])
  .option('-b, --bumper <bumper>', 'bump version', 'patch')
  .option('-no-b, --no-bumper', 'no bump version')
  .option('-s, --silent', 'no output')
  .option('-p, --preview', 'preview publish')
  .action(async ({ preview, silent, bumper, ...options }: {
    preview?: boolean
    silent?: boolean
    bumper: false | BumperType
  }) => {
    actionRestore()

    const { value = {} } = await getSelectedProjectsGraph() ?? {}
    const selectedProjectsGraphEntries = Object.entries(value)
    if (selectedProjectsGraphEntries.length === 0) {
      throw new Error('no packages selected')
    }
    const manifests = selectedProjectsGraphEntries
      .map(([dir, manifest]) => {
        const { type, exports: entrypoints = {} } = manifest
        const pkgIsModule = type === 'module'
        const newManifest = { ...manifest }
        const [resolvedEntrypoints, exports] = getExports({
          entrypoints,
          pkgIsModule,
          config: loadConfig(dir),
          dir,
          noFilter: true,
          isPublish: true
        })
        newManifest.exports = {
          ...resolvedEntrypoints,
          ...exports
        }
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
    for (const [dir, manifest] of manifests) {
      const oldJSONString = fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')
      const oldJSON = JSON.parse(oldJSONString) ?? '0.0.0'
      const newVersion = bumper ? bump(oldJSON.version, bumper) : oldJSON.version
      // TODO detectIndent by editorconfig
      const { indent = '    ' } = detectIndent(oldJSONString)
      const formattingOptions = {
        tabSize: indent.length,
        insertSpaces: true
      }
      let newJSONString = oldJSONString
      newJSONString = applyEdits(
        newJSONString,
        modify(
          newJSONString,
          ['version'],
          newVersion,
          { formattingOptions }
        )
      )
      for (const [key, value] of Object.entries(manifest)) {
        if (JSON.stringify(value) === JSON.stringify(oldJSON[key])) continue

        if (key !== 'exports') {
          newJSONString = applyEdits(
            newJSONString,
            modify(
              newJSONString,
              ['publishConfig', key],
              value,
              { formattingOptions }
            )
          )
        } else {
          const exports = value as Record<string, unknown>
          for (const [k, v] of Object.entries(exports)) {
            newJSONString = applyEdits(
              newJSONString,
              modify(
                newJSONString,
                ['publishConfig', 'exports', k],
                v,
                { formattingOptions }
              )
            )
          }
          const index = exports?.['.']
          const indexPublishConfig: Record<string, string> = {}
          if (index) {
            switch (typeof index) {
              case 'string':
                indexPublishConfig[
                  manifest?.type === 'module' ? 'module' : 'main'
                ] = index
                break
              case 'object': {
                const indexExports = index as Record<string, string>
                indexPublishConfig.main = indexExports['require'] ?? indexExports['default']
                indexPublishConfig.module = indexExports['import'] ?? indexExports['module'] ?? indexExports['default']
                break
              }
            }
            for (const [k, v] of Object.entries(indexPublishConfig)) {
              if (v === undefined) continue
              newJSONString = applyEdits(
                newJSONString,
                modify(
                  newJSONString,
                  ['publishConfig', k],
                  v,
                  { formattingOptions }
                )
              )
            }
          }
        }
      }
      try {
        fs.renameSync(path.join(dir, 'package.json'), path.join(dir, 'package.json.bak'))
        fs.writeFileSync(path.join(dir, 'package.json'), newJSONString)
        !silent && console.log(newJSONString)
        if (preview) {
          !silent && console.warn('preview mode')
          continue
        }
        const args = ['pnpm', 'publish', '--access', 'public', '--no-git-checks', ...passArgs]
        if (bumper && TAGS.includes(bumper)) {
          args.push('--tag', bumper)
        }
        childProcess.execSync(args.join(' '), {
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
