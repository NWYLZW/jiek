import path from 'node:path'

import { commondir } from '@jiek/utils/commondir'

type Cloneable = Record<PropertyKey, unknown> | unknown[]

export const deepClone = (
  obj: Cloneable,
  {
    filter
  }: {
    filter?: (keys: PropertyKey[], value: unknown) => boolean
  } = {},
  keys: PropertyKey[] = []
) => {
  return Array.isArray(obj)
    ? obj
      .filter((_, i) => {
        return !(filter && !filter(keys, obj[i]))
      })
      .map((value, i): unknown => {
        const newKeys = [...keys, i]
        if (typeof value === 'object' && value !== null) {
          return deepClone(value as Cloneable, { filter }, newKeys)
        }
        return value
      })
    : Object
      .entries(obj as Record<PropertyKey, unknown>)
      .reduce((acc, [key, value]) => {
        const newKeys = [...keys, key]
        if (filter && !filter(newKeys, value)) return acc
        if (typeof value === 'object' && value !== null) {
          const newValue = deepClone(value as Cloneable, { filter }, newKeys)
          if (Object.keys(newValue).length !== 0) {
            acc[key] = newValue
          }
        } else {
          acc[key] = value
        }
        return acc
      }, {} as Record<PropertyKey, unknown>)
}

export const DEFAULT_SKIP_KEYS = [
  /\.json$/,
  /\.d(\..*)?\.ts$/,
  /\.css$/
]

export const DEFAULT_SKIP_VALUES = [
  /\.[cm]?js$/,
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
  withConditional?: Partial<
    Record<
      | 'bundled'
      | (string & {}),
      | boolean
      | ((opts: { src: string; dist: string; path: string; conditionals: string[] }) => boolean | string)
      | undefined
    >
  >
  sourceTag?: string
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

export type RecursiveRecord<T> = {
  [K in string]: T | RecursiveRecord<T>
}

type GetAllLeafsShouldSkip = (context: {
  key: string
  keys: string[]
  value: unknown
  level: number
}) => boolean

export function filterLeafs(
  obj: RecursiveRecord<string>,
  {
    skipKey = DEFAULT_SKIP_KEYS,
    skipValue = DEFAULT_SKIP_VALUES
  }: Pick<Entrypoints2ExportsOptions, 'skipKey' | 'skipValue'> = {}
): RecursiveRecord<string> {
  return deepClone(obj, {
    filter: (keys, value) => {
      const key = keys[keys.length - 1]
      if (
        keys.length === 1 && skipKey && skipKey.some(k => {
          if (typeof k === 'string') {
            return key === k
          }
          if (typeof key === 'string') {
            return key.match(k)
          }
          return false
        })
      ) {
        return false
      }
      // noinspection RedundantIfStatementJS
      if (typeof value === 'string' && skipValue && skipValue.some(v => value.match(v))) {
        return false
      }
      return true
    }
  }) as RecursiveRecord<string>
}

export function getAllLeafs(
  obj: RecursiveRecord<string>,
  shouldSkip?: GetAllLeafsShouldSkip,
  keys: string[] = [],
  level = 1
): string[] {
  return Object
    .entries(obj)
    .reduce<string[]>((acc, [key, value]) => {
      const newKeys = [...keys, key]
      if (shouldSkip && shouldSkip({ key, keys: newKeys, value, level })) return acc
      if (typeof value === 'string') {
        acc.push(value)
      } else {
        acc.push(...getAllLeafs(value, shouldSkip, newKeys, level + 1))
      }
      return acc
    }, [])
}

export function resolveEntrypoints(
  entrypoints: string | string[] | Record<string, unknown>,
  options: Pick<
    Entrypoints2ExportsOptions,
    'cwd' | 'skipKey' | 'skipValue'
  > = {}
) {
  const {
    cwd = process.cwd(),
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
      // 叶子节点列表需要按照配置的规则过滤掉，这些被过滤掉的叶子结点不需要参与到共用目录的计算
      const leafs = [
        ...new Set(getAllLeafs(filterLeafs(entrypoints as RecursiveRecord<string>, { skipKey, skipValue })))
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
  return [dir!, entrypointMapping] as const
}

// https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-role-of-declaration-files

export function entrypoints2Exports(
  entrypoints: string | string[] | Record<string, unknown>,
  options: Entrypoints2ExportsOptions = {}
): Record<string, unknown> {
  const {
    outdir = './dist',
    withConditional = {},
    sourceTag,
    withSource = false,
    withSuffix = false,
    skipKey = DEFAULT_SKIP_KEYS,
    skipValue = DEFAULT_SKIP_VALUES
  } = options
  const sourceFieldName = sourceTag
    ? `${sourceTag}/__source__`
    : 'source'

  const [dir, entrypointMapping] = resolveEntrypoints(JSON.parse(JSON.stringify(entrypoints)), options)
  const withConditionalKeys = Object.keys(withConditional)
  function resolvePath(value: string, path: string, conditionalKeys: string[]) {
    let newValue = value as unknown
    if (typeof value === 'string') {
      const outfile = value
        .replace(dir!, outdir)
        .replace(/\.([cm])?[tj]sx?$/, '.$1js')
      newValue = outfile
      const isCjs = outfile.endsWith('.cjs')
      const isMjs = outfile.endsWith('.mjs')
      let v = outfile as unknown
      if (withSource || withConditionalKeys.length) {
        const record = {} as Record<string, unknown>
        if (withSource) {
          record[sourceFieldName] = value
        }
        withConditionalKeys.forEach(k => {
          const conditional = withConditional[k]
          switch (typeof conditional) {
            case 'function': {
              const result = conditional({
                src: value,
                dist: outfile,
                path,
                conditionals: conditionalKeys
              })
              if (result === false) break

              record[k] = result === true ? value : result
              break
            }
            case 'boolean':
              record[k] = value
              break
          }
        })
        record.default = outfile
        v = record
      }
      if (isCjs || isMjs) {
        newValue = {
          [isCjs ? 'require' : 'import']: v
        }
      } else {
        newValue = v
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
          newValue = resolvePath(value, key, [])
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
            .reduce<Record<string, unknown>>((acc, [conditional, v]) => {
              if (typeof v !== 'string') {
                throw new Error(`Not support nested conditional value: ${v}`)
              }
              // TODO skip by conditional
              if (skipValue && skipValue.some(item => v.match(item))) {
                acc[conditional] = v
                return acc
              }
              acc[conditional] = resolvePath(v as string, key, [conditional])
              if (withSource && typeof acc[conditional] === 'string') {
                acc[conditional] = {
                  source: v,
                  default: acc[conditional]
                }
              }
              return acc
            }, {})
          break
      }
      entrypointMapping[key] = newValue
      if (typeof newValue === 'string') {
        const shouldNested = withSource || withConditionalKeys.length
        if (shouldNested) {
          const v = {} as Record<string, unknown>
          if (withSource) {
            v[sourceFieldName] = value
          }
          withConditionalKeys.forEach(k => {
            const conditional = withConditional[k]
            switch (typeof conditional) {
              case 'function': {
                const result = conditional({
                  src: value as string,
                  dist: newValue,
                  path: key,
                  conditionals: []
                })
                if (result === false) break
                v[k] = result === true ? value : result
                break
              }
              case 'boolean':
                v[k] = value
                break
            }
          })
          v.default = newValue
          entrypointMapping[key] = v
        }
      }
      if (withSuffix && key !== '.' && !key.match(/\.[cm]?jsx?$/)) {
        entrypointMapping[`${key}.js`] = entrypointMapping[key]
      }
    })
  return entrypointMapping
}
