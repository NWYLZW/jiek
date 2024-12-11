import inject from '@rollup/plugin-inject'
import type { Plugin } from 'rollup'

const virtualModuleName = 'jiek:create-require'

const INSERT_STR = (isESM: boolean) =>
  `
${isESM ? `import { createRequire } from 'node:module'` : ''}
export default ${isESM ? '/* @__PURE__ */ createRequire(import.meta.url)' : 'require'}
`.trim()

export default (isEsm: boolean): Plugin => ({
  ...inject({
    require: virtualModuleName
  }),
  name: 'create-require',
  resolveId: id => (
    id === virtualModuleName
      ? id
      : null
  ),
  load: id => (
    id === virtualModuleName
      ? INSERT_STR(isEsm)
      : null
  )
})
