import { defineConfig } from 'jiek'

export default defineConfig({
  publish: {
    parallel: tag =>
      tag === 'latest' && {
        debug: { include: ['src'] }
      }
  }
})
