import { resolve } from 'node:path'

import type { Options } from '@jiek/pkger'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import json from '@rollup/plugin-json'
import autoprefixer from 'autoprefixer'
import { InputPluginOption, Plugin, RollupOptions } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import postcss from 'rollup-plugin-postcss'
import { MultiBar, Presets } from 'cli-progress'

import { createGlobalsLinkage } from './plugins/globals'
import skip from './plugins/skip'
import { commonOutputOptions } from './utils/commonOptions'
import externalResolver from './utils/externalResolver'
import withMinify from './utils/withMinify'

const workspaceRoot = getWorkspaceDir()
function resolveWorkspacePath(p: string) {
  return resolve(workspaceRoot, p)
}

function progress(
  entries: string[],
  onProcessing: (entry: string) => void,
  onTransforming: (id: string) => void,
  onProcessed: (name: string, fileName: string) => void
): Plugin {
  return {
    name: 'progress',
    resolveId(source, importer) {
      if (entries.includes(source) || importer === undefined)
        onProcessing(source)
    },
    transform(_, id) {
      onTransforming(id)
    },
    writeBundle(options, bundle) {
      Object.entries(bundle).forEach(([key, value]) => {
        if (value.name === undefined || !('isEntry' in value)) return
        onProcessed(value.name, value.fileName)
      })
    }
  }
}

export const template = (
  {
    styled = false,
    plugins: {
      index: indexPlugins = [],
      entry: entryPlugins = [],
      dts: dtsPlugins = []
    } = {}
  }: {
    /**
     * include styles files
     */
    styled?: boolean
    plugins?: {
      index?: InputPluginOption
      entry?: InputPluginOption
      dts?: InputPluginOption
    }
  } = {},
  pkg: {
    name?: string
    jiek?: Options
    exports?: Record<string, string | {
      import: string
      'inner-src': string
    }>
  }
) => {
  const { jiek: {
    noBrowser = false,
    outdir = 'dist'
  } = {} } = pkg
  const outputOptions = {
    ...commonOutputOptions,
    dir: outdir
  }
  if (!pkg.name) {
    throw new Error('pkg.name is required')
  }
  const namePrefix = pkg
    .name
    .replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
  const exportsEntries = Object.fromEntries(
    Object.entries(pkg.exports ?? {})
      // filter outdir entries
      .filter(([key]) => !key.startsWith(`./${outdir}`) && !key.startsWith(outdir))
      // filter static files
      .filter(([key]) => !/\.(json|css|scss)$/.test(key))
      // filter no `inner-src` or `import` field entries
      .filter(([, value]) => typeof value === 'object' && value['inner-src'] && value['import'])
      .map(([key, value]) => [
        key
          .replace(/^\.$/, 'index')
          .replace(/^\.\//, ''),
        typeof value === 'string' ? value : value['inner-src']
      ])
  )

  const [globalsRegister, globalsOutput] = createGlobalsLinkage()
  const external = externalResolver()

  const commonOptions = {
  } satisfies RollupOptions
  const commonPlugins = [
    json()
  ]
  const multiBars = new MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '- {bar} | {type} | {entry} | {message}'
  }, Presets.shades_classic)
  const entries = Object.values(exportsEntries)
  const progressState = {
    esm: entries.reduce((add, entry) => {
      const bar = multiBars.create(100, 0)
      bar.update(0, { type: 'esm', entry, message: 'waiting' })
      return { ...add, [entry]: bar }
    }, {} as Record<string, ReturnType<typeof multiBars.create>>),
    umd: entries.reduce((add, entry) => {
      const bar = multiBars.create(100, 0)
      bar.update(0, { type: 'umd', entry, message: 'waiting' })
      return { ...add, [entry]: bar }
    }, {} as Record<string, ReturnType<typeof multiBars.create>>),
    dts: entries.reduce((add, entry) => {
      const bar = multiBars.create(100, 0)
      bar.update(0, { type: 'dts', entry, message: 'waiting' })
      return { ...add, [entry]: bar }
    }, {} as Record<string, ReturnType<typeof multiBars.create>>)
  }
  const resolved = entries.reduce((entries, entry) => ({ ...entries, [entry]: false }), {} as Record<string, boolean>)
  return [
    {
      ...commonOptions,
      input: exportsEntries,
      output: [
        ...withMinify({
          ...outputOptions,
          format: 'esm',
          entryFileNames: '[name].esm.js',
          preserveModules: true
        })
      ],
      plugins: [
        progress(
          Object.values(exportsEntries),
          entry => {
            const bar = progressState.esm[entry]
            if (!bar) return
            bar.update(0, { type: 'esm', entry, message: 'processing' })
          },
          id => {
            const bar = progressState.esm[id]
            if (!bar) return
            bar.update(50, { type: 'esm', entry: id, message: `transforming ${id}` })
          },
          (name, fileName) => {
            const entry = exportsEntries[name]
            const bar = progressState.esm[entry]
            if (!bar) return
            if (!fileName.endsWith('.min.js')) {
              bar.update(95, { type: 'esm', entry, message: `processed` })
            } else {
              bar.update(100, { type: 'esm', entry, message: `finished` })
            }
          }
        ),
        commonPlugins,
        globalsRegister({ external }),
        styled && skip({ patterns: [/\.s?css$/] }),
        esbuild(),
        indexPlugins
      ]
    },
    ...Object.entries(exportsEntries).map(([name, input]) => {
      const outputName = namePrefix + (
        name === 'index' ? '' : (
          name.replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
        )
      )
      return {
        ...commonOptions,
        input: input,
        output: noBrowser ? [
          ...withMinify({
            ...outputOptions,
            name: outputName,
            format: 'cjs',
            entryFileNames: `${name}.cjs`
          })
        ] : [
          ...withMinify({
            ...outputOptions,
            name: outputName,
            format: 'iife',
            entryFileNames: `${name}.iife.js`
          }),
          ...withMinify({
            ...outputOptions,
            name: outputName,
            format: 'umd',
            entryFileNames: `${name}.umd.js`
          })
        ],
        plugins: [
          progress(
            [input],
            entry => {
              const bar = progressState.umd[entry]
              if (!bar) return
              bar.update(0, { type: 'umd', entry, message: 'processing' })
            },
            id => {
              const bar = progressState.umd[input]
              if (!bar) return
              bar.update(50, { type: 'umd', input, message: `transforming ${id}` })
            },
            (name, fileName) => {
              const bar = progressState.umd[input]
              if (!bar) return
              if (!fileName.endsWith('.min.js')) {
                bar.update(95, { type: 'umd', input, message: `processed` })
              } else {
                bar.update(100, { type: 'umd', input, message: `finished` })
              }
            }
          ),
          commonPlugins,
          globalsOutput,
          styled && postcss({
            plugins: [autoprefixer],
            minimize: true,
            sourceMap: true,
            extract: `${name}.css`
          }),
          esbuild(),
          entryPlugins
        ],
        external
      }
    }),
    {
      ...commonOptions,
      input: exportsEntries,
      output: [
        {
          dir: 'dist'
        },
        {
          dir: 'dist',
          entryFileNames: ({ name }) => `${name.replace(/^src\//, '')}.esm.d.ts`,
          preserveModules: true
        }
      ],
      plugins: [
        progress(
          Object.values(exportsEntries),
          entry => {
            const bar = progressState.dts[entry]
            if (!bar) return
            bar.update(0, { type: 'dts', entry, message: 'processing' })
          },
          id => {
            const bar = progressState.dts[id]
            if (!bar) return
            bar.update(50, { type: 'dts', entry: id, message: `transforming ${id}` })
          },
          (name, fileName) => {
            const entry = exportsEntries[name]
            const bar = progressState.dts[entry]
            if (!bar) return
            if (!fileName.endsWith('.esm.d.ts')) {
              bar.update(95, { type: 'dts', entry, message: `processed` })
            } else {
              bar.update(100, { type: 'dts', entry, message: `finished` })
              resolved[entry] = true
            }
            if (Object.values(resolved).every(Boolean)) {
              setTimeout(() => {
                multiBars.stop()
              }, 100)
            }
          }
        ),
        commonPlugins,
        styled && skip({ patterns: [/\.s?css$/] }),
        dts({ tsconfig: resolveWorkspacePath('tsconfig.dts.json') }),
        {
          name: 'rollup-plugin-declare-module-replacer',
          /**
           * replace relative path `declare module './xxx'` to `declare module '{{package name}}'`
           * in output file generated
           */
          generateBundle(_, bundle) {
            for (const file of Object.values(bundle)) {
              if (!('code' in file)) continue

              file.code = file.code.replace(
                /declare module ['|"]\..*['|"]/g,
                `declare module '${pkg.name}'`
              )
            }
          }
        },
        dtsPlugins
      ],
      external
    }
  ] as RollupOptions[]
}
