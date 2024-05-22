import { resolve } from 'node:path'

import type { Options } from '@jiek/pkger'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import json from '@rollup/plugin-json'
import autoprefixer from 'autoprefixer'
import type { InputPluginOption, RollupOptions } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import postcss from 'rollup-plugin-postcss'

import { createGlobalsLinkage } from './plugins/globals'
import skip from './plugins/skip'
import { commonOutputOptions } from './utils/commonOptions'
import externalResolver from './utils/externalResolver'
import withMinify from './utils/withMinify'

const workspaceRoot = getWorkspaceDir()
function resolveWorkspacePath(p: string) {
  return resolve(workspaceRoot, p)
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

  const commonPlugins = [
    json()
  ]
  return [
    {
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
      input: exportsEntries,
      output: [
        {
          dir: 'dist',
          entryFileNames: ({ name }) => `${name.replace(/^src\//, '')}.esm.d.ts`,
          preserveModules: true
        },
        {
          dir: 'dist'
        }
      ],
      plugins: [
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
