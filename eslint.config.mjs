import { dirname, resolve } from 'node:path'
import process from 'node:process'

process.env.JIEK_ESLINT_CONFIG_ROOT = dirname(import.meta.url).slice(7)
process.env.JIEK_TS_PROJECT = resolve(process.env.JIEK_ESLINT_CONFIG_ROOT, 'tsconfig.json')

export { default } from '@jiek/standard/eslint.config'
