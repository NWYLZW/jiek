import type { PluginImpl } from 'rollup'

export default (() => ({
  name: 'jiek:with-external',
  resolveId: {
    order: 'pre',
    handler: (source, _, { attributes }) => {
      if (attributes.external === 'true') {
        return {
          id: source,
          external: true
        }
      }
    }
  }
})) as PluginImpl<{}>
