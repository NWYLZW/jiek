import type { PluginImpl } from 'rollup'

export default (() => ({
  name: 'jiek:with-external',
  resolveId: {
    order: 'pre',
    handler: (source, _, { attributes }) => {
      if (
        'external' in attributes || 'bundle' in attributes
      ) {
        return {
          id: source,
          external: attributes.external === 'true'
            ? true
            : attributes.bundle !== 'true'
        }
      }
    }
  }
})) as PluginImpl<{}>
