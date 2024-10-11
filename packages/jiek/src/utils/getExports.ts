import { relative, resolve } from 'node:path'

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

export function getExports({
  entrypoints,
  pkgIsModule,
  entries,
  config,
  dir
}: {
  entrypoints: string | string[] | Record<string, unknown>
  pkgIsModule: boolean
  entries?: string[]
  config?: Config
  dir?: string
}) {
  const dirResolve = (...paths: string[]) => resolve(dir ?? process.cwd(), ...paths)
  const dirRelative = (path: string) => relative(dir ?? process.cwd(), path)
  const { build = {} } = config ?? {}
  const {
    crossModuleConvertor = true
  } = build
  const jsOutdir = `./${
    dirRelative(dirResolve(
      (
        typeof build?.output?.dir === 'object'
          // the outdir only affect js output in this function
          ? build.output.dir.js
          : build?.output?.dir
      ) ?? 'dist'
    ))
  }`
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
  const filteredResolvedEntrypoints = filterLeafs(
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
      outdir: jsOutdir,
      withConditional: {
        ...crossModuleWithConditional
      }
    })
  ] as const
}
