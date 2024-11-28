// https://github.com/privatenumber/pkgroll/blob/73559f8864203a50a5aa12c0a6503ceed3690aff/src/utils/rollup-plugins/create-require.ts#L1
// Thanks to @privatenumber for the snippet

import inject from '@rollup/plugin-inject'
import replace from '@rollup/plugin-replace'
import type { Plugin } from 'rollup'

const virtualModuleName = 'jiek:create-require'

/**
 * Since rollup is bundled by rollup, it needs to add a run-time
 * suffix so that this doesn't get replaced.
 */
const isEsmVariableName = `IS_ESM${Math.random().toString(36).slice(2)}`

const INSERT_STR = `
import { createRequire } from 'node:module'

export default (
  ${isEsmVariableName}
    ? /* @__PURE__ */ createRequire(import.meta.url)
    : require
)
`.trim()

/**
 * Plugin to seamlessly allow usage of `require`
 * across CJS and ESM modules.
 *
 * This is usually nor a problem for CJS outputs,
 * but for ESM outputs, it must be used via
 * createRequire.
 *
 * This plugin automatically injects it for ESM.
 */
export default (): Plugin => ({
  ...inject({
    require: virtualModuleName
  }),

  name: 'create-require',

  resolveId: source => (
    (source === virtualModuleName)
      ? source
      : null
  ),

  load: (id) => {
    if (id !== virtualModuleName) {
      return null
    }

    return INSERT_STR
  }
})

export const isFormatEsm = (
  isEsm: boolean
): Plugin => {
  const handler = replace({
    [isEsmVariableName]: isEsm
  }).renderChunk!

  return ({
    name: 'create-require-insert-format',

    // Pick out renderChunk because it's used as an output plugin
    renderChunk: {
      order: 'pre',
      handler: typeof handler === 'function' ? handler : handler.handler
    }
  })
}
