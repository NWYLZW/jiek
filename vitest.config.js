import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: [
        'html',
        'json',
        'json-summary'
      ]
    },
    pool: 'threads',
    include: ['**/tests/**/*.spec.ts'],
    typecheck: {
      include: ['**/tests/**/*.spec.ts']
    },
    env: {
      NODE_ENV: 'test',
      PROJECT_ROOT: import.meta.url
        .replace(/^(file:\/\/)/, '')
        .replace(/\/vitest\.config\.js$/, '')
    }
  }
})
