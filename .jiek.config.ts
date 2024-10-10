import { defineConfig } from 'jiek'

export default defineConfig({
  init: {
    named: {
      'packages/rollup-plugins/*': 'rollup-plugin-$basename',
      'packages/vite-plugins/*': 'vite-plugin-$basename'
    }
  }
})
