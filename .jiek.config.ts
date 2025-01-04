import { defineConfig } from 'jiek'

export default defineConfig({
  publish: {
    parallel: tag =>
      tag === 'default' && {
        'full': {
          include: ['src']
        },
        'esm': {
          exclude: ['*.cjs']
        },
        'cjs': {
          exclude: ['*.js']
        }
      }
  }
})
