#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

process.env.JIEK_IS_ONLY_BUILD = 'true'

const __dirname = dirname(import.meta.url.replace('file://', ''))
if (existsSync(resolve(__dirname, '../.jiek-dev-tag'))) {
  const require = createRequire(import.meta.url)
  require('esbuild-register')
  require('../src/cli-only-build.ts')
} else {
  import('jiek/cli-only-build')
}