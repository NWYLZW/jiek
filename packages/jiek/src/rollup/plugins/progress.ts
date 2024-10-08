import type { PluginImpl } from 'rollup'

interface Options {
  onEvent?: (event: string, message?: string) => void
}

export default ((options = {}) => {
  const { onEvent } = options
  return {
    name: 'progress',
    buildStart: () => onEvent?.('start', 'Start building...'),
    buildEnd: () => onEvent?.('end', 'Build completed!'),
    resolveId: {
      order: 'post',
      handler: source => onEvent?.('resolve', `Resolving ${source}...`)
    },
    load: {
      order: 'post',
      handler: id => onEvent?.('load', `Loading ${id}...`)
    },
    transform: {
      order: 'post',
      handler: (_, id) => onEvent?.('transform', `Transforming ${id}...`)
    }
  }
}) as PluginImpl<Options>
