/* eslint-disable ts/strict-boolean-expressions */
import '#~/polyfill'

import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import type { SingleBar } from 'cli-progress'
import { MultiBar } from 'cli-progress'
import type { Command } from 'commander'
import { program } from 'commander'
import detectIndent from 'detect-indent'
import type { JSONPath } from 'jsonc-parser'
import { applyEdits, modify } from 'jsonc-parser'

import type { BumperType } from '@jiek/utils/bumper'
import { bump } from '@jiek/utils/bumper'
import type { Config } from 'jiek'

import { createAreaManagement } from '#~/commands/utils/createAreaManagement'
import type { ProjectsGraph } from '#~/utils/filterSupport'
import { getSelectedProjectsGraph } from '#~/utils/filterSupport'
import { getInternalModuleName } from '#~/utils/getInternalModuleName'
import { loadConfig } from '#~/utils/loadConfig'
import type { ResolveExportsOptions } from '#~/utils/resolveExports'
import { resolveExports } from '#~/utils/resolveExports'

import { outdirDescription } from './descriptions'

declare module 'jiek' {
  interface ConfigExperimental {
    /**
     * Polyfill `imports` fields in package.json to local dependencies and exports fields.
     * @default false
     */
    importsDowngrade?: boolean
  }
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
      parallel?: (tag: string) =>
        | false
        | void
        | null
        | Record<string, {
          include?: string[]
          overrideInclude?: string[]
          exclude?: string[]
          overrideExclude?: string[]
        }>
    }
  }
}

const description = `
Publish package to npm registry, and auto generate exports field and other fields in published package.json.
If you want to through the options to the \`pnpm publish\` command, you can pass the options after '--'.
`.trim()

async function forEachSelectedProjectsGraphEntries(
  callback: (dir: string, manifest: NonNullable<ProjectsGraph['value']>[string]) => void | Promise<void>
) {
  const { value = {} } = await getSelectedProjectsGraph() ?? {}
  const selectedProjectsGraphEntries = Object.entries(value)
  if (selectedProjectsGraphEntries.length === 0) {
    throw new Error('no packages selected')
  }
  await Promise.all(selectedProjectsGraphEntries.map(async ([dir, manifest]) => callback(dir, manifest)))
}

interface PublishOptions {
  outdir?: string
  bumper: false | BumperType
  /**
   * Skip entries which end with '.js'.
   */
  skipJS: boolean
}

const attachPublishOptions = (command: Command) =>
  command
    .option('-b, --bumper <bumper>', 'bump version')
    .option('-no-b, --no-bumper', 'no bump version')
    .option('-o, --outdir <OUTDIR>', outdirDescription, String, 'dist')
    .option('--skipJS', 'skip entries which end with ".js"')

attachPublishOptions(
  program
    .command('publish')
    .description(description)
    .aliases(['pub', 'p'])
)
  .action(async ({
    outdir,
    bumper = 'patch',
    skipJS
  }: PublishOptions) => {
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

    const mb = new MultiBar({
      hideCursor: true,
      format: '{message}'
    })
    const bars: Record<string, SingleBar | undefined> = {}
    const outputLines: string[] = []
    function render() {
      let i: number
      for (i = 0; i < outputLines.length; i++) {
        let bar = bars[i]
        if (!bar) {
          bars[i] = bar = mb.create(0, 0, { message: '' })
        }
        bar.update({ message: outputLines[i] })
      }
      for (; i < Object.keys(bars).length; i++) {
        mb.remove(bars[i]!)
      }
    }
    const areaManagement = createAreaManagement({
      maxSize: 5,
      outputLines,
      onAreaUpdate: render
    })

    await forEachSelectedProjectsGraphEntries(async (dir, { name }) => {
      const relativePath = path.relative(process.cwd(), dir)
      const config = loadConfig(dir)
      const { parallel } = config.publish ?? {}

      const args = ['pnpm', 'publish']
      args.push(...passThroughOptions)
      const env = {
        ...process.env,
        JIEK_PUBLISH_OUTDIR: JSON.stringify(outdir),
        JIEK_PUBLISH_BUMPER: JSON.stringify(bumper),
        JIEK_PUBLISH_SKIP_JS: JSON.stringify(skipJS)
      }
      const tag = bumper === false || ['minor', 'major', 'patch'].includes(bumper)
        ? 'latest'
        : bumper

      const parallelConfig = parallel?.(tag)

      async function pubByPnpm(
        type?: string,
        attachArgs: string[] = [],
        isReady: boolean | Promise<void> = false
      ) {
        const area = areaManagement.create({
          header: `┌ publishing [${name}] ./${relativePath}${type ? ` @${type}` : ''}`,
          footer: '└──────────────────'
        })
        const info = (message: string) =>
          area.info(
            message.trim().split('\n').map(s => `│ ${s}`).join('\n')
          )
        info('waiting for ready...')
        isReady && await isReady
        const child = exec(
          [...args, ...attachArgs, '--tag', type ?? tag].join(' '),
          { cwd: dir, windowsHide: true, env }
        )
        await new Promise<void>(resolve => {
          child.stdout?.on('data', (data: string) => info(data))
          child.stderr?.on('data', (data: string) => info(data))
          child.once('exit', code => {
            if (code === 0) {
              resolve()
            } else {
              info(`pnpm publish exited with code ${code}`)
              resolve()
            }
          })
        })
        await area.exit()
      }
      const buildEnd = Promise.withResolvers<void>()
      await Promise.all([
        pubByPnpm()
          .then(() => buildEnd.resolve())
          .catch(e => buildEnd.reject(e)),
        ...Object.entries(parallelConfig ?? {}).map(async ([type]) => {
          await pubByPnpm(type, ['--ignore-scripts'], buildEnd.promise)
        })
      ])
    })
    mb.stop()
  })

async function prepublish({
  bumper,
  skipJS
}: PublishOptions) {
  const {
    JIEK_PUBLISH_OUTDIR: outdirEnv,
    JIEK_PUBLISH_BUMPER: bumperEnv,
    JIEK_PUBLISH_SKIP_JS: skipJSEnv
  } = process.env
  const outdir = outdirEnv
    ? JSON.parse(outdirEnv) as string
    : 'dist'
  bumper = bumper ?? (
    bumperEnv ? JSON.parse(bumperEnv) as string | boolean : false
  )
  skipJS = skipJS ?? (
    skipJSEnv ? JSON.parse(skipJSEnv) as boolean : undefined
  )

  const generateNewManifest = (
    dir: string,
    manifest: NonNullable<ProjectsGraph['value']>[string],
    config: Config
  ) => {
    const {
      name,
      type,
      exports: entrypoints,
      imports: internalEntrypoints
    } = manifest
    if (!name) {
      throw new Error(`package.json in ${dir} must have a name field`)
    }

    const pkgIsModule = type === 'module'
    const newManifest = { ...manifest }
    const commonOptions = {
      pkgIsModule,
      pkgName: name,
      config,
      dir,
      noFilter: true,
      isPublish: true,
      skipJS: skipJS ?? config.skipJS
    } satisfies Partial<ResolveExportsOptions>
    let resolvedOutdir = outdir
    if (entrypoints) {
      const [resolvedEntrypoints, exports, _resolvedOutdir] = resolveExports({
        entrypoints,
        defaultOutdir: outdir,
        ...commonOptions
      })
      newManifest.exports = {
        ...resolvedEntrypoints,
        ...exports
      }
      if (resolvedOutdir === outdir) {
        resolvedOutdir = _resolvedOutdir
      }
    }
    if (internalEntrypoints) {
      const [resolvedInternalEntrypoints, imports, _resolvedOutdir] = resolveExports({
        entrypoints: internalEntrypoints,
        defaultOutdir: `${outdir}/.internal`,
        ...commonOptions
      })
      newManifest.imports = {
        ...resolvedInternalEntrypoints,
        ...imports
      }
      if (resolvedOutdir === outdir) {
        resolvedOutdir = _resolvedOutdir
      }
    }
    return [newManifest, resolvedOutdir] as const
  }

  const generateNewPackageJSONString = ({
    config,
    oldJSONString,
    oldJSON,
    manifest,
    formattingOptions
  }: {
    config: Config
    oldJSONString: string
    oldJSON: Record<string, unknown>
    manifest: NonNullable<ProjectsGraph['value']>[string]
    formattingOptions: {
      tabSize: number
      insertSpaces: boolean
    }
  }) => {
    const internalModuleName = getInternalModuleName(manifest.name!)

    let newJSONString = oldJSONString
    const update = (path: JSONPath, value: unknown) => {
      newJSONString = applyEdits(
        newJSONString,
        modify(newJSONString, path, value, { formattingOptions })
      )
    }

    update(['publishConfig', 'typesVersions'], {
      '<5.0': {
        '*': [
          '*',
          './*',
          './*/index.d.ts',
          './*/index.d.mts',
          './*/index.d.cts'
        ]
      }
    })
    if (config.experimental?.importsDowngrade) {
      update(['dependencies', internalModuleName], `file:./${outdir}/.internal`)
      update(['dependenciesMeta', internalModuleName], {
        'injected': true
      })
      update(['imports'], undefined)
    }

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
              indexPublishConfig.types = indexExports.types
              break
            }
          }
          indexPublishConfig.types = indexPublishConfig[
            manifest?.type === 'module' ? 'module' : 'main'
          ].replace(/\.([cm]?)js$/, '.d.$1ts')
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
    const config = loadConfig(dir)
    const [manifest, resolvedOutdir] = generateNewManifest(dir, originalManifest, config)
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
      ? bump(oldJSON.version, bumper)
      : oldJSON.version
    const modifyVersionPackageJSON = applyEdits(
      oldJSONString,
      modify(oldJSONString, ['version'], newVersion, { formattingOptions })
    )

    const newJSONString = generateNewPackageJSONString({
      config,
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
    const resolvedExports = manifest.exports as Record<string, unknown>
    Object
      .keys(resolvedExports)
      .forEach(key => {
        if (key === '.') return
        if (/\.[cm]?js$/.test(key)) return
        // resource file suffix
        const resourceFileSuffixes = [
          '.d.ts',
          '.d.mts',
          '.d.cts',
          '.css',
          '.scss',
          '.sass',
          '.less',
          '.styl',
          '.stylus',
          '.json',
          '.json5'
        ]
        if (resourceFileSuffixes.find(suffix => key.endsWith(suffix))) return

        const value = resolvedExports[key] as {
          import?: string
          require?: string
          default?: string
        }

        const filepath = resolveByDir(resolvedOutdir, key)

        fs.mkdirSync(filepath, { recursive: true })
        const pkgJSONPath = resolveByDir(resolvedOutdir, key, 'package.json')
        const relativePath = Array.from({ length: key.split('/').length - 1 }, () => '..').join('/')
        const { type } = manifest
        const pkgJSON: Record<string, unknown> = { type }
        if ('default' in value) {
          pkgJSON[
            type === 'module' ? 'module' : 'main'
          ] = [
            relativePath,
            value.default?.replace(/^\.\//, '')
          ].join('/')
        }
        if ('import' in value) {
          pkgJSON.module = [
            relativePath,
            value.import?.replace(/^\.\//, '')
          ].join('/')
        }
        if ('require' in value) {
          pkgJSON.main = [
            relativePath,
            value.require?.replace(/^\.\//, '')
          ].join('/')
        }
        fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSON))
      })
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

    if (config.experimental?.importsDowngrade && 'imports' in manifest && manifest.imports) {
      fs.writeFileSync(
        resolveByDir(resolvedOutdir, resolvedOutdir, '.internal', 'package.json'),
        JSON.stringify(
          {
            name: getInternalModuleName(manifest.name!),
            exports: JSON.parse(
              JSON
                .stringify(manifest.imports)
                .replaceAll('#', './')
                .replaceAll('~', '')
            ) as Record<string, unknown>
          },
          null,
          2
        )
      )
    }

    const jiekProductionTag = path.resolve(resolvedOutdir, '.jiek-production-tag')
    if (!fs.existsSync(jiekProductionTag)) {
      fs.writeFileSync(jiekProductionTag, '')
    }
  })
}

// eslint-disable-next-line no-empty-pattern
async function postpublish({}: PublishOptions) {
  await forEachSelectedProjectsGraphEntries(dir => {
    const jiekTempDir = path.resolve(dir, 'node_modules/.jiek/.tmp')
    const packageJSONPath = path.resolve(dir, 'package.json')
    const { name, version } = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8')) as {
      name: string
      version: string
    }
    const jiekTempPackageJSONPath = path.resolve(jiekTempDir, 'package.json')
    if (fs.existsSync(jiekTempPackageJSONPath)) {
      fs.copyFileSync(jiekTempPackageJSONPath, packageJSONPath)
      fs.rmSync(jiekTempPackageJSONPath)
      /* eslint-disable no-console */
      console.log(`${dir}/package.json has been restored`)
      console.log(
        `if you want to check the compatibility of the package, you can visit: https://arethetypeswrong.github.io/?p=${name}%40${version}`
      )
      /* eslint-enable no-console */
    } else {
      throw new Error(
        `jiek temp \`${dir}/package.json\` not found, please confirm the jiek pre-publish command has been executed`
      )
    }
  })
}

const prepublishDescription = `
Prepare package.json for publish, you can add \`jk\` to the \`prepublish\` script in package.json, the command will automatically run \`jk prepublish\`.
.e.g
{
  "scripts": {
    "prepublish": "jk"
  }
}
`.trim()
attachPublishOptions(
  program
    .command('prepublish')
    .description(prepublishDescription)
)
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
attachPublishOptions(
  program
    .command('postpublish')
    .description(postpublishDescription)
)
  .action(postpublish)

const {
  npm_lifecycle_event: NPM_LIFECYCLE_EVENT
} = process.env

if (
  NPM_LIFECYCLE_EVENT && [
    'prepublish',
    'postpublish'
  ].includes(NPM_LIFECYCLE_EVENT)
) {
  attachPublishOptions(program)
    .action(async (options: PublishOptions) => {
      switch (NPM_LIFECYCLE_EVENT) {
        case 'prepublish':
          await prepublish(options)
          break
        case 'postpublish':
          await postpublish(options)
          break
      }
    })
}
