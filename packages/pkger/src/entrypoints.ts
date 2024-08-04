import path from 'node:path'

import { commondir } from '@jiek/utils/commondir'

export const DEFAULT_SKIP_KEYS = [
  /\.json$/,
  /\.d(\..*)?\.ts$/,
  /\.css$/
]

export const DEFAULT_SKIP_VALUES = [
  /\.[cm]js$/,
  ...DEFAULT_SKIP_KEYS
]

export interface Entrypoints2ExportsOptions {
  /**
   * @default './dist'
   */
  outdir?: string
  /**
   * @default `process.cwd()`
   */
  cwd?: string
  /**
   * @default false
   */
  withSource?: boolean
  /**
   * @default false
   */
  withSuffix?: boolean
  /**
   * @default DEFAULT_SKIP_KEYS
   */
  skipKey?: false | (string | RegExp)[]
  /**
   * @todo
   */
  skipConditional?: false | (string | RegExp)[]
  /**
   * @default DEFAULT_SKIP_KEYS
   */
  skipValue?: false | (string | RegExp)[]
}

type RecursiveRecord<T> = {
  [K in string]: T | RecursiveRecord<T>
}

type GetAllLeafsShouldSkip = ({ key, value, level }: { key: string; value: unknown; level: number }) => boolean

function getAllLeafs(obj: RecursiveRecord<string>, shouldSkip?: GetAllLeafsShouldSkip, level = 1): string[] {
  return Object
    .entries(obj)
    .reduce<string[]>((acc, [key, value]) => {
      if (shouldSkip && shouldSkip({ key, value, level })) return acc
      if (typeof value === 'string') {
        acc.push(value)
      } else {
        acc.push(...getAllLeafs(value, shouldSkip, level + 1))
      }
      return acc
    }, [])
}

// https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-role-of-declaration-files

export function entrypoints2Exports(
  entrypoints: string | string[] | Record<string, unknown>,
  options: Entrypoints2ExportsOptions = {}
): Record<string, unknown> {
  const {
    outdir = './dist',
    cwd = process.cwd(),
    withSource = false,
    withSuffix = false,
    skipKey = DEFAULT_SKIP_KEYS,
    skipValue = DEFAULT_SKIP_VALUES
  } = options
  let entrypointMapping: Record<string, unknown> = {}
  let dir: string | undefined
  if (typeof entrypoints === 'string') {
    entrypointMapping = { '.': entrypoints }
    dir = path.dirname(entrypoints)
  }
  if (Array.isArray(entrypoints)) {
    entrypoints = skipValue
      ? entrypoints.filter(entry => !skipValue.some(k => entry.match(k)))
      : entrypoints
    dir = entrypoints.length > 1
      ? commondir(entrypoints, cwd)
        .replace(`${cwd}/`, './')
        .replace(/\/$/, '')
      : (
        entrypoints.length === 0
          ? ''
          : path.dirname(entrypoints[0])
      )
    entrypoints.forEach((point, i) => {
      const trimmedCommonDirPath = point
        .replace(`${dir}/`, '')
      const isIndex = i === 0 && trimmedCommonDirPath.match(/index\.[cm]?[tj]sx?$/)?.length
      if (isIndex) {
        entrypointMapping['.'] = point
      } else {
        entrypointMapping[
          `./${
            trimmedCommonDirPath
              .replace(/\.([cm])?[tj]sx?$/, '')
          }`
        ] = point
      }
    })
  } else {
    if (typeof entrypoints === 'object') {
      entrypointMapping = entrypoints
      const leafs = [
        ...new Set(getAllLeafs(
          entrypoints as RecursiveRecord<string>,
          ({ key, value, level }) => {
            let is = false
            if (level === 1) {
              is ||= skipKey && skipKey.some(k => key.match(k))
            }
            if (typeof value === 'string') {
              is ||= skipValue && skipValue.some(v => value.match(v))
            }
            return is
          }
        ))
      ]
      dir = leafs.length > 1
        ? commondir(leafs, cwd)
          .replace(`${cwd}/`, './')
          .replace(/\/$/, '')
        : (
          leafs.length === 0
            ? ''
            : path.dirname(leafs[0])
        )
    }
  }
  function resolvePath(value: string) {
    let newValue = value as unknown
    if (typeof value === 'string') {
      const outfile = value
        .replace(dir!, outdir)
        .replace(/\.([cm])?[tj]sx?$/, '.$1js')
      newValue = outfile
      if (outfile.endsWith('.cjs')) {
        newValue = withSource
          ? { require: { source: value, default: outfile } }
          : { require: outfile }
      }
      if (outfile.endsWith('.mjs')) {
        newValue = withSource
          ? { import: { source: value, default: outfile } }
          : { import: outfile }
      }
    }
    return newValue
  }
  Object
    .entries(entrypointMapping)
    .forEach(([key, value]) => {
      if (skipKey && skipKey.some(k => key.match(k))) return
      let newValue = value
      switch (typeof value) {
        case 'string':
          if (skipValue && skipValue.some(v => value.match(v))) return
          newValue = resolvePath(value)
          break
        case 'object':
          if (value === null) break
          if (Array.isArray(value)) {
            /**
             * TODO Handle nested array
             * '.': ['src/index.ts', 'src/index.styless.ts']
             */
            break
          }
          newValue = Object
            .entries(value)
            .reduce<Record<string, unknown>>((acc, [k, v]) => {
              // TODO skip by conditional
              if (skipValue && skipValue.some(item => v.match(item))) {
                acc[k] = v
                return acc
              }
              acc[k] = resolvePath(v as string)
              if (withSource && typeof acc[k] === 'string') {
                acc[k] = {
                  source: v,
                  default: acc[k]
                }
              }
              return acc
            }, {})
          break
      }
      entrypointMapping[key] = withSource && typeof newValue === 'string'
        ? { source: value, default: newValue }
        : newValue
      if (withSuffix && key !== '.' && !key.match(/\.[cm]?jsx?$/)) {
        entrypointMapping[`${key}.js`] = entrypointMapping[key]
      }
    })
  return entrypointMapping
}
