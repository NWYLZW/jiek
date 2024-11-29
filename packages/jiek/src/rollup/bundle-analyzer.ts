import process from 'node:process'

import type { InputPluginOption, OutputPlugin, Plugin } from 'rollup'
import type { AnalyzerPluginInternalAPI } from 'vite-bundle-analyzer'

export type Module = ReturnType<AnalyzerPluginInternalAPI['processModule']>[number]

const {
  JIEK_ANALYZER
} = process.env

const ANALYZER = (JIEK_ANALYZER != null) && JSON.parse(JIEK_ANALYZER) as {
  dir?: string
  mode?: string
  size?: string
  port?: number
  open?: boolean
}

export function bundleAnalyzer(modulesResolved: (modules: Module[]) => void) {
  // eslint-disable-next-line ts/strict-boolean-expressions
  if (!ANALYZER) {
    return []
  }

  const defaultSizes = ({
    parsed: 'parsed',
    stat: 'stat',
    gzip: 'gzip'
  } as const)[ANALYZER.size ?? 'stat'] ?? 'parsed'

  let module: typeof import('vite-bundle-analyzer') | undefined
  let ana: Plugin | undefined
  async function initAna() {
    const { adapter, analyzer } = module ?? await import('vite-bundle-analyzer')
    ana = ana ?? adapter(analyzer({
      defaultSizes,
      analyzerMode: modulesResolved
    }))
  }

  return [
    (async () => {
      await initAna()
      return {
        name: 'jiek:bundle-analyzer',
        async closeBundle(...args) {
          if (typeof ana!.closeBundle !== 'function') return

          return ana!.closeBundle?.call(this, ...args)
        }
      } satisfies InputPluginOption
    })(),
    (async () => {
      await initAna()
      return {
        ...ana,
        name: 'jiek:bundle-analyzer-output'
      } satisfies OutputPlugin
    })()
  ] as const
}
