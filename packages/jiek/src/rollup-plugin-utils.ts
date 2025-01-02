import { isMatch } from 'micromatch'
import type { PluginImpl } from 'rollup'

export const definePlugin = <O extends object>(plugin: PluginImpl<O>) => plugin

export interface FilterOptions {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]
}

export function createFilter(options: FilterOptions) {
  const { include = [], exclude = [] } = options

  const resolvedInclude = Array.isArray(include) ? include : [include]
  const resolvedExclude = Array.isArray(exclude) ? exclude : [exclude]

  return (id: string) => {
    if (typeof id !== 'string') return false
    const isInclude = resolvedInclude.length === 0 || resolvedInclude.some(filter => {
      return filter instanceof RegExp
        ? filter.test(id)
        : isMatch(id, filter)
    })
    const isExclude = resolvedExclude.length > 0 && resolvedExclude.some(filter => {
      return filter instanceof RegExp
        ? filter.test(id)
        : isMatch(id, filter)
    })

    return !isInclude || isExclude
  }
}
