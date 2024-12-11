import type { Plugin } from 'rollup'

export const CREATE_REQUIRE_VIRTUAL_MODULE_NAME = 'jiek:create-require'

const INSERT_STR = (isESM: boolean) =>
  `
${isESM ? `import { createRequire } from 'node:module'` : ''}
export default ${isESM ? '/* @__PURE__ */ createRequire(import.meta.url)' : 'require'}
`.trim()

export default (isEsm: boolean): Plugin => ({
  name: 'create-require',
  resolveId: id => (
    id === CREATE_REQUIRE_VIRTUAL_MODULE_NAME
      ? id
      : null
  ),
  load: id => (
    id === CREATE_REQUIRE_VIRTUAL_MODULE_NAME
      ? INSERT_STR(isEsm)
      : null
  )
})
