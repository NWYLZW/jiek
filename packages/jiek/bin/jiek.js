#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'

const __dirname = dirname(import.meta.url.replace('file://', ''))
if (existsSync(resolve(__dirname, '../.jiek-dev-tag'))) {
  const require = createRequire(import.meta.url)
  require('esbuild-register')
  require('../src/cli.ts')
} else {
  import('jiek/cli')
}
