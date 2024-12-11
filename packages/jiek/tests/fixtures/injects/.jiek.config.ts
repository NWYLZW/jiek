import { defineConfig } from 'jiek'

export default defineConfig({
  build: {
    injects: { $: 'jquery' }
  }
})
