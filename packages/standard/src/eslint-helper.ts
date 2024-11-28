import type { OptionsConfig, TypedFlatConfigItem } from '@antfu/eslint-config'
import type { Linter } from 'eslint'
import type { FlatConfigComposer } from 'eslint-flat-config-utils'

type Awaitable<T> = T | Promise<T>

export const defineLintBase = (opts: OptionsConfig & Omit<TypedFlatConfigItem, 'files'>) => opts

export const defineExt = async (
  opts: Awaitable<TypedFlatConfigItem | TypedFlatConfigItem[] | FlatConfigComposer<any, any> | Linter.Config[]>
) => opts
