import { defineConfig } from 'jiek'

export default defineConfig({
  build: {
    replacementsOptions: {
      mode: 'ast-grep'
    },
    replacements: {
      'console.log($A)': ctx => ctx.mode === 'ast-grep' && `console.warn(${ctx.$`A`})`,
      'console.info($A)': `console.error($A)`
    }
  }
})
