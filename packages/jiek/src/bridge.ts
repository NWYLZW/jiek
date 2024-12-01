import type { Module } from '#~/rollup/bundle-analyzer.ts'

import { sendMessage } from 'execa'

export const bridgeDisabledRef = { value: false }

export interface RollupBuildEntryCtx {
  type: 'esm' | 'cjs'
  name: string
  path: string
  exportConditions: string[]
  input: string
}

export interface RollupBuildEventMap {
  init: {
    leafMap: Map<string, string[][]>
    targetsLength: number
  }
  progress: RollupBuildEntryCtx & {
    tags?: string[]
    event?: string
    message?: string
  }
  watchChange: RollupBuildEntryCtx & {
    id: string
  }
  modulesAnalyze: RollupBuildEntryCtx & {
    modules: Module[]
  }
  debug: unknown
}

export type RollupBuildEvent = keyof RollupBuildEventMap extends infer K
  ? K extends infer Item extends keyof RollupBuildEventMap ? {
      type: Item
      data: RollupBuildEventMap[Item]
    }
  : never
  : never

export const publish = async <K extends keyof RollupBuildEventMap>(type: K, data: RollupBuildEventMap[K]) => {
  if (bridgeDisabledRef.value) return Promise.resolve()

  return sendMessage({ type, data })
}
