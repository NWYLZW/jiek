import path from 'node:path'

import { commondir } from '@jiek/utils/commondir'

export interface Entrypoints2ExportsOptions {
  /**
   * @default 'dist'
   */
  outdir?: string
  /**
   * @default `process.cwd()`
   */
  cwd?: string
}

type RecursiveRecord<T> = {
  [K in string]: T | RecursiveRecord<T>
}

function getAllLeafs(obj: RecursiveRecord<string>): string[] {
  return Object
    .entries(obj)
    .reduce<string[]>((acc, [, value]) => {
      if (typeof value === 'string') {
        acc.push(value)
      } else {
        acc.push(...getAllLeafs(value))
      }
      return acc
    }, [])
}

export function entrypoints2Exports(
  entrypoints: string | string[] | Record<string, unknown>,
  options: Entrypoints2ExportsOptions = {}
): Record<string, unknown> {
  const {
    outdir = 'dist',
    cwd = process.cwd()
  } = options
  let entrypointMapping: Record<string, unknown> = {}
  let dir: string | undefined
  if (typeof entrypoints === 'string') {
    entrypointMapping = { '.': entrypoints }
    dir = path.dirname(entrypoints)
  }
  if (Array.isArray(entrypoints)) {
    dir = entrypoints.length > 1
      ? commondir(entrypoints, cwd)
        .replace(`${cwd}/`, '')
        .replace(/\/$/, '')
      : path.dirname(entrypoints[0])
    entrypoints.forEach((point, i) => {
      const trimmedCommonDirPath = point
        .replace(`${dir!}/`, '')
      const isIndex = i === 0 && trimmedCommonDirPath.match(/index\.[c|m]?[t|j]sx?$/)?.length
      if (isIndex) {
        entrypointMapping['.'] = point
      } else {
        entrypointMapping[
          `./${
            trimmedCommonDirPath
              .replace(/\.([c|m])?[t|j]sx?$/, '')
          }`
        ] = point
      }
    })
  } else {
    if (typeof entrypoints === 'object') {
      entrypointMapping = entrypoints
      const leafs = getAllLeafs(entrypoints as RecursiveRecord<string>)
      dir = leafs.length > 1
        ? commondir(leafs, cwd)
          .replace(`${cwd}/`, '')
          .replace(/\/$/, '')
        : path.dirname(leafs[0])
    }
  }
  Object
    .entries(entrypointMapping)
    .forEach(([key, value]) => {
      let newValue = value
      if (typeof value === 'string') {
        const outfile = value
          .replace(dir!, outdir)
          .replace(/\.([c|m])?[t|j]sx?$/, '.$1js')
        newValue = outfile
        if (outfile.endsWith('.cjs')) {
          newValue = { require: outfile }
        }
        if (outfile.endsWith('.mjs')) {
          newValue = { import: outfile }
        }
      }
      entrypointMapping[key] = newValue
    })
  return entrypointMapping
}
