import { createRequire } from 'node:module'

export default createRequire(import.meta.url)('./eslint.config.store.js')