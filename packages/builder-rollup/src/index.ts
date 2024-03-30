import fs from 'node:fs'
import { resolve } from 'node:path'

import { pkger } from '@jiek/pkger'
import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
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

const dir = process.cwd()
const pkgJson = JSON.parse(fs.readFileSync(resolve(dir, 'package.json'), 'utf-8'))
const mergedPkgJson = {
  ...pkgJson,
  ...pkger({ cwd: dir })
} as {
  name: string
  exports?: Record<string, {
    import: string
    'inner-src': string
  }>
}
const namePrefix = mergedPkgJson
  .name
  .replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
const exportsEntriesFromPkgJSON = Object.fromEntries(
  Object.entries(mergedPkgJson.exports ?? {})
    // filter static files
    .filter(([key]) => !/\.(json|css|scss)$/.test(key))
    // filter no `inner-src` or `import` field entries
    .filter(([, value]) => value['inner-src'] && value['import'])
    .map(([key, value]) => [
      key
        .replace(/^\.$/, 'index')
        .replace(/^\.\//, ''),
      value['inner-src']
    ])
)

export default (
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
  exportsEntries: Record<string, string> = exportsEntriesFromPkgJSON
) => {
  const [globalsRegister, globalsOutput] = createGlobalsLinkage()
  const external = externalResolver()

  return [
    {
      input: exportsEntries,
      output: [
        ...withMinify({
          ...commonOutputOptions,
          format: 'esm',
          entryFileNames: '[name].esm.js',
          preserveModules: true
        })
      ],
      plugins: [
        globalsRegister({ external }),
        styled && skip({ patterns: [/\.s?css$/] }),
        esbuild(),
        indexPlugins
      ]
    },
    ...Object.entries(exportsEntries).map(([name, input]) => {
      const outputName = namePrefix + (
        name === 'index' ? '' : (
          name[0].toUpperCase() + name.slice(1)
        )
      )
      return {
        input: input,
        output: [
          ...withMinify({
            ...commonOutputOptions,
            name: outputName,
            format: 'iife',
            entryFileNames: `${name}.iife.js`
          }),
          ...withMinify({
            ...commonOutputOptions,
            name: outputName,
            format: 'umd',
            entryFileNames: `${name}.umd.js`
          })
        ],
        plugins: [
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
                `declare module '${mergedPkgJson.name}'`
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
