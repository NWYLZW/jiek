import { defineConfig } from 'jiek'

export default defineConfig({
  build: {
    replacements: {
      'process.env.DEBUG': 'false',
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.BUILD_PATH': ctx => JSON.stringify(ctx.id)
    }
  }
})
