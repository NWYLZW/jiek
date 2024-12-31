import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

import {
  type Entrypoints2ExportsOptions,
  type RecursiveRecord,
  entrypoints2Exports,
  filterLeafs,
  getDefaultSkipValues,
  resolveEntrypoints
} from '@jiek/pkger/entrypoints'
import type { Config } from 'jiek'
import { isMatch } from 'micromatch'

import { intersection } from '#~/utils/intersection'

const {
  JIEK_OUT_DIR,
  JIEK_CROSS_MODULE_CONVERTOR
} = process.env

const OUTDIR = JIEK_OUT_DIR ?? 'dist'
const crossModuleConvertorDefault = JIEK_CROSS_MODULE_CONVERTOR === undefined
  ? true
  : JIEK_CROSS_MODULE_CONVERTOR === 'true'

export function getOutDirs({
  cwd = process.cwd(),
  defaultOutdir = OUTDIR,
  config,
  pkgName
}: {
  cwd?: string
  defaultOutdir?: string
  config?: Config
  pkgName?: string
}) {
  const { build = {} } = config ?? {}
  const outdir = build?.output?.dir
  function resolveOutdir(type: 'js' | 'dts') {
    const dir = (typeof outdir === 'object'
      ? outdir[type] ?? outdir[
        ({
          js: 'dts',
          dts: 'js'
        } as const)[type]
      ]
      : outdir) ?? defaultOutdir
    return (
      isAbsolute(dir)
        ? dir
        : `./${relative(cwd, resolve(cwd, dir))}`
    ).replace('{{PKG_NAME}}', pkgName!)
  }
  return {
    js: resolveOutdir('js'),
    dts: resolveOutdir('dts')
  }
}

export interface ResolveExportsOptions {
  entrypoints: string | string[] | Record<string, unknown>
  pkgName: string
  pkgIsModule: boolean
  entries?: string[]
  config?: Config
  dir?: string
  outdir?: string
  defaultOutdir?: string
  noFilter?: boolean
  isPublish?: boolean
  skipJS?: boolean
}

export function resolveExports({
  entrypoints,
  pkgName,
  pkgIsModule,
  entries,
  config,
  dir,
  defaultOutdir = OUTDIR,
  // FIXME dts support
  outdir = getOutDirs({ pkgName, defaultOutdir, config, cwd: dir }).js,
  noFilter,
  isPublish,
  skipJS
}: ResolveExportsOptions) {
  const {
    build = {},
    publish: {
      withSuffix = false,
      withSource = true
    } = {}
  } = config ?? {}
  const {
    crossModuleConvertor = crossModuleConvertorDefault
  } = build
  const [, resolvedEntrypoints] = resolveEntrypoints(entrypoints, {
    allowJS: !skipJS
  })
  if (entries) {
    Object
      .entries(resolvedEntrypoints)
      .forEach(([key]) => {
        if (!entries.some(e => isMatch(key, e, { matchBase: true }))) {
          delete resolvedEntrypoints[key]
        }
      })
  }
  const filteredResolvedEntrypoints = noFilter ? resolvedEntrypoints : filterLeafs(
    resolvedEntrypoints as RecursiveRecord<string>,
    {
      skipValue: [
        // ignore values that filename starts with `.jk-noentry`
        /(^|\/)\.jk-noentry/,
        ...getDefaultSkipValues({
          allowJS: !skipJS
        })
      ]
    }
  )
  const crossModuleWithConditional: Entrypoints2ExportsOptions['withConditional'] = crossModuleConvertor
    ? {
      import: opts => {
        if (pkgIsModule) return false
        if (opts.src.endsWith('.cts')) return false
        if (
          intersection(
            new Set(opts.conditionals),
            new Set(['import', 'module'])
          ).size !== 0
        ) return false

        return opts.dist.replace(/\.js$/, '.mjs')
      },
      require: opts => {
        if (!pkgIsModule) return false
        if (opts.src.endsWith('.mts')) return false
        if (
          intersection(
            new Set(opts.conditionals),
            new Set(['require', 'node'])
          ).size !== 0
        ) return false

        return opts.dist.replace(/\.js$/, '.cjs')
      }
    }
    : {}
  return [
    filteredResolvedEntrypoints,
    entrypoints2Exports(filteredResolvedEntrypoints, {
      outdir,
      sourceTag: pkgName,
      withSuffix: isPublish ? withSuffix : undefined,
      withSource: isPublish ? withSource : undefined,
      withConditional: {
        ...crossModuleWithConditional
      },
      allowJS: !skipJS
    }),
    outdir
  ] as const
}
