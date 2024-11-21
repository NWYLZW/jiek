import { isAbsolute, relative, resolve } from 'node:path'

import {
  DEFAULT_SKIP_VALUES,
  entrypoints2Exports,
  type Entrypoints2ExportsOptions,
  filterLeafs,
  type RecursiveRecord,
  resolveEntrypoints
} from '@jiek/pkger/entrypoints'
import type { Config } from 'jiek'
import { isMatch } from 'micromatch'

const intersection = <T>(a: Set<T>, b: Set<T>) => new Set([...a].filter(i => b.has(i)))

const {
  JIEK_OUT_DIR
} = process.env

const OUTDIR = JIEK_OUT_DIR ?? 'dist'

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

export function getExports({
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
  isPublish
}: {
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
}) {
  const {
    build = {},
    publish: {
      withSuffix = false,
      withSource = true
    } = {}
  } = config ?? {}
  const {
    crossModuleConvertor = true
  } = build
  const [, resolvedEntrypoints] = resolveEntrypoints(entrypoints)
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
        ...DEFAULT_SKIP_VALUES
      ]
    }
  )
  const crossModuleWithConditional: Entrypoints2ExportsOptions['withConditional'] = crossModuleConvertor
    ? {
      import: opts =>
        !pkgIsModule && intersection(
              new Set(opts.conditionals),
              new Set(['import', 'module'])
            ).size === 0
          ? opts.dist.replace(/\.js$/, '.mjs')
          : false,
      require: opts =>
        pkgIsModule && intersection(
              new Set(opts.conditionals),
              new Set(['require', 'node'])
            ).size === 0
          ? opts.dist.replace(/\.js$/, '.cjs')
          : false
    }
    : {}
  return [
    filteredResolvedEntrypoints,
    entrypoints2Exports(filteredResolvedEntrypoints, {
      outdir,
      withSuffix: isPublish ? withSuffix : undefined,
      withSource: isPublish ? withSource : undefined,
      withConditional: {
        ...crossModuleWithConditional
      }
    }),
    outdir
  ] as const
}
