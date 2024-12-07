/* eslint-disable ts/strict-boolean-expressions */
import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { type BumperType, TAGS, bump } from '@jiek/utils/bumper'
import { program } from 'commander'
import detectIndent from 'detect-indent'
import { applyEdits, modify } from 'jsonc-parser'

import type { ProjectsGraph } from '../utils/filterSupport'
import { getSelectedProjectsGraph } from '../utils/filterSupport'
import { getExports } from '../utils/getExports'
import { loadConfig } from '../utils/loadConfig'
import { outdirDescription } from './descriptions'

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

const description = `
Publish package to npm registry, and auto generate exports field and other fields in published package.json.
If you want to through the options to the \`pnpm publish\` command, you can pass the options after '--'.
`.trim()

async function forEachSelectedProjectsGraphEntries(
  callback: (dir: string, manifest: NonNullable<ProjectsGraph['value']>[string]) => void
) {
  const { value = {} } = await getSelectedProjectsGraph() ?? {}
  const selectedProjectsGraphEntries = Object.entries(value)
  if (selectedProjectsGraphEntries.length === 0) {
    throw new Error('no packages selected')
  }
  for (const [dir, manifest] of selectedProjectsGraphEntries) {
    callback(dir, manifest)
  }
}

program
  .command('publish')
  .description(description)
  .aliases(['pub', 'p'])
  .option('-b, --bumper <bumper>', 'bump version', 'patch')
  .option('-no-b, --no-bumper', 'no bump version')
  .option('-o, --outdir <OUTDIR>', outdirDescription, String, 'dist')
  .action(async ({ outdir, bumper }: {
    outdir?: string
    bumper: false | BumperType
  }) => {
    let shouldPassThrough = false

    const passThroughOptions = process.argv
      .reduce(
        (acc, value) => {
          if (shouldPassThrough) {
            acc.push(value)
          }
          if (value === '--') {
            shouldPassThrough = true
          }
          return acc
        },
        [] as string[]
      )

    await forEachSelectedProjectsGraphEntries(dir => {
      const args = ['pnpm', 'publish', '--access', 'public', '--no-git-checks']
      if (bumper && TAGS.includes(bumper)) {
        args.push('--tag', bumper)
      }
      args.push(...passThroughOptions)
      childProcess.execSync(args.join(' '), {
        cwd: dir,
        stdio: 'inherit',
        env: {
          ...process.env,
          JIEK_PUBLISH_OUTDIR: JSON.stringify(outdir),
          JIEK_PUBLISH_BUMPER: JSON.stringify(bumper)
        }
      })
    })
  })

async function prepublish({ bumper }: {
  bumper?: boolean | BumperType
} = {}) {
  const {
    JIEK_PUBLISH_OUTDIR: outdirEnv,
    JIEK_PUBLISH_BUMPER: bumperEnv
  } = process.env
  const outdir = outdirEnv
    ? JSON.parse(outdirEnv) as string
    : 'dist'
  bumper = bumper ?? (
    bumperEnv ? JSON.parse(bumperEnv) as string | boolean : false
  )

  const generateNewManifest = (dir: string, manifest: NonNullable<ProjectsGraph['value']>[string]) => {
    const { name, type, exports: entrypoints = {} } = manifest
    if (!name) {
      throw new Error(`package.json in ${dir} must have a name field`)
    }

    const pkgIsModule = type === 'module'
    const newManifest = { ...manifest }
    const [resolvedEntrypoints, exports, resolvedOutdir] = getExports({
      entrypoints,
      pkgIsModule,
      pkgName: name,
      config: loadConfig(dir),
      dir,
      defaultOutdir: outdir,
      noFilter: true,
      isPublish: true
    })
    newManifest.exports = {
      ...resolvedEntrypoints,
      ...exports
    }
    return [newManifest, resolvedOutdir] as const
  }

  const generateNewPackageJSONString = ({
    oldJSONString,
    oldJSON,
    manifest,
    formattingOptions
  }: {
    oldJSONString: string
    oldJSON: Record<string, unknown>
    manifest: NonNullable<ProjectsGraph['value']>[string]
    formattingOptions: {
      tabSize: number
      insertSpaces: boolean
    }
  }) => {
    let newJSONString = oldJSONString
    newJSONString = applyEdits(
      newJSONString,
      modify(
        newJSONString,
        ['publishConfig', 'typesVersions'],
        {
          '<5.0': {
            '*': [
              '*',
              `./*`,
              `./*/index.d.ts`,
              `./*/index.d.mts`,
              `./*/index.d.cts`
            ]
          }
        },
        { formattingOptions }
      )
    )
    for (const [key, value] of Object.entries(manifest)) {
      if (key === 'version') continue
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
          // eslint-disable-next-line ts/switch-exhaustiveness-check
          switch (typeof index) {
            case 'string':
              indexPublishConfig[
                manifest?.type === 'module' ? 'module' : 'main'
              ] = index
              break
            case 'object': {
              const indexExports = index as Record<string, string>
              indexPublishConfig.main = indexExports.require ?? indexExports.default
              indexPublishConfig.module = indexExports.import ?? indexExports.module ?? indexExports.default
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
    if (oldJSON.devDependencies) {
      newJSONString = applyEdits(
        newJSONString,
        modify(
          newJSONString,
          ['devDependencies'],
          undefined,
          { formattingOptions }
        )
      )
    }
    if (oldJSON.peerDependencies) {
      const peerDependenciesMeta = Object.keys(oldJSON.peerDependencies).reduce(
        (acc, key) => {
          acc[key] = { optional: true }
          return acc
        },
        {} as Record<string, { optional: boolean }>
      )
      newJSONString = applyEdits(
        newJSONString,
        modify(
          newJSONString,
          ['peerDependenciesMeta'],
          peerDependenciesMeta,
          { formattingOptions }
        )
      )
    }
    if (oldJSON.files) {
      newJSONString = applyEdits(
        newJSONString,
        modify(
          newJSONString,
          ['files'],
          undefined,
          { formattingOptions }
        )
      )
    }
    return newJSONString
  }

  await forEachSelectedProjectsGraphEntries((dir, originalManifest) => {
    const [manifest, resolvedOutdir] = generateNewManifest(dir, originalManifest)
    const resolveByDir = (...paths: string[]) => path.resolve(dir, ...paths)

    const oldJSONString = fs.readFileSync(resolveByDir('package.json'), 'utf-8')
    const oldJSON = JSON.parse(oldJSONString) as Record<string, unknown>
    if (typeof oldJSON.version !== 'string') {
      throw new TypeError(`${dir}/package.json must have a version field with a string value`)
    }

    // TODO detectIndent by editorconfig
    const { indent = '    ' } = detectIndent(oldJSONString)
    const formattingOptions = {
      tabSize: indent.length,
      insertSpaces: true
    }

    const newVersion = bumper
      ? bump(oldJSON.version, bumper === true ? 'patch' : bumper)
      : oldJSON.version
    const modifyVersionPackageJSON = applyEdits(
      oldJSONString,
      modify(oldJSONString, ['version'], newVersion, { formattingOptions })
    )

    const newJSONString = generateNewPackageJSONString({
      oldJSONString: modifyVersionPackageJSON,
      oldJSON: {
        ...oldJSON,
        version: newVersion
      },
      manifest,
      formattingOptions
    })

    const withPublishConfigDirectoryOldJSONString = applyEdits(
      modifyVersionPackageJSON,
      modify(modifyVersionPackageJSON, ['publishConfig', 'directory'], resolvedOutdir, { formattingOptions })
    )

    if (!fs.existsSync(resolveByDir(resolvedOutdir))) {
      fs.mkdirSync(resolveByDir(resolvedOutdir))
    }
    const jiekTempDir = resolveByDir('node_modules/.jiek/.tmp')
    if (!fs.existsSync(resolveByDir(jiekTempDir))) {
      fs.mkdirSync(resolveByDir(jiekTempDir), { recursive: true })
    }

    fs.writeFileSync(resolveByDir(resolvedOutdir, 'package.json'), newJSONString)
    fs.writeFileSync(resolveByDir(jiekTempDir, 'package.json'), modifyVersionPackageJSON)
    fs.writeFileSync(resolveByDir('package.json'), withPublishConfigDirectoryOldJSONString)

    const allBuildFiles = fs
      .readdirSync(resolveByDir(resolvedOutdir), { recursive: true })
      .filter(file => typeof file === 'string')
      .filter(file => file !== 'package.json')
    for (const file of allBuildFiles) {
      const filepath = resolveByDir(resolvedOutdir, file)
      const stat = fs.statSync(filepath)
      if (stat.isDirectory()) {
        const existsIndexFile = allBuildFiles
          .some(f =>
            [
              path.join(file, 'index.js'),
              path.join(file, 'index.mjs'),
              path.join(file, 'index.cjs')
            ].includes(f)
          )
        if (existsIndexFile) {
          const cpDistPath = resolveByDir(resolvedOutdir, resolvedOutdir, file)
          const pkgJSONPath = resolveByDir(resolvedOutdir, file, 'package.json')
          const relativePath = path.relative(filepath, cpDistPath)
          const { type } = manifest
          fs.writeFileSync(
            pkgJSONPath,
            JSON.stringify({
              type,
              main: [relativePath, `index.${type === 'module' ? 'c' : ''}js`].join('/'),
              module: [relativePath, `index.${type === 'module' ? '' : 'm'}js`].join('/')
            })
          )
        }
      }
    }
    fs.mkdirSync(resolveByDir(resolvedOutdir, resolvedOutdir))
    for (const file of allBuildFiles) {
      const filepath = resolveByDir(resolvedOutdir, file)
      const newFilepath = resolveByDir(resolvedOutdir, resolvedOutdir, file)
      const stat = fs.statSync(filepath)
      if (stat.isDirectory()) {
        fs.mkdirSync(newFilepath, { recursive: true })
        continue
      }
      if (stat.isFile()) {
        fs.cpSync(filepath, newFilepath)
        fs.rmSync(filepath)
      }
    }

    if (oldJSON.files) {
      if (Array.isArray(oldJSON.files)) {
        if (oldJSON.files.every((file: unknown) => typeof file !== 'string')) {
          throw new TypeError(`${dir}/package.json files field must be an array of string`)
        }
      } else {
        throw new TypeError(`${dir}/package.json files field must be an array`)
      }
    }
    const resolvedOutdirAbs = resolveByDir(resolvedOutdir)
    const files = (
      (oldJSON.files as undefined | string[]) ?? fs.readdirSync(resolveByDir('.'))
    ).filter(file =>
      ![
        'node_modules',
        'package.json',
        'pnpm-lock.yaml'
      ].includes(file) && resolveByDir(file) !== resolvedOutdirAbs
    )

    for (const file of files) {
      const path = resolveByDir(file)
      try {
        const stat = fs.statSync(path)
        if (stat.isDirectory()) {
          fs.cpSync(path, resolveByDir(resolvedOutdir, file), { recursive: true })
          continue
        }
        if (stat.isFile()) {
          fs.cpSync(path, resolveByDir(resolvedOutdir, file))
          continue
        }
      } catch (e) {
        console.warn(String(e))
        continue
      }
      throw new Error(`file type of ${path} is not supported`)
    }
  })
}

async function postpublish() {
  await forEachSelectedProjectsGraphEntries(dir => {
    const jiekTempDir = path.resolve(dir, 'node_modules/.jiek/.tmp')
    const packageJSON = path.resolve(dir, 'package.json')
    const jiekTempPackageJSON = path.resolve(jiekTempDir, 'package.json')
    if (fs.existsSync(jiekTempPackageJSON)) {
      fs.copyFileSync(jiekTempPackageJSON, packageJSON)
      fs.rmSync(jiekTempPackageJSON)
      // eslint-disable-next-line no-console
      console.log(`${dir}/package.json has been restored`)
    } else {
      throw new Error(
        `jiek temp \`${dir}/package.json\` not found, please confirm the jiek pre-publish command has been executed`
      )
    }
  })
}

program
  .action(async () => {
    const {
      npm_lifecycle_event: NPM_LIFECYCLE_EVENT
    } = process.env
    // eslint-disable-next-line ts/switch-exhaustiveness-check
    switch (NPM_LIFECYCLE_EVENT) {
      case 'prepublish':
        await prepublish()
        break
      case 'postpublish':
        await postpublish()
        break
      default:
        program.help()
    }
  })

const prepublishDescription = `
Prepare package.json for publish, you can add \`jk\` to the \`prepublish\` script in package.json, the command will automatically run \`jk prepublish\`.
.e.g
{
  "scripts": {
    "prepublish": "jk"
  }
}
`.trim()
program
  .command('prepublish')
  .description(prepublishDescription)
  .option('-b, --bumper <bumper>', 'bump version')
  .option('-no-b, --no-bumper', 'no bump version')
  .action(prepublish)

const postpublishDescription = `
Restore package.json after publish, you can add \`jk\` to the \`postpublish\` script in package.json, the command will automatically run \`jk postpublish\`.
.e.g
{
  "scripts": {
    "postpublish": "jk"
  }
}
`.trim()
program
  .command('postpublish')
  .description(postpublishDescription)
  .action(postpublish)
