#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

if (fs.existsSync(path.join(__dirname, '../.jiek-dev-tag'))) {
  require('esbuild-register')
  require('../src/cli.ts')
} else {
  require('jiek/cli')
}
