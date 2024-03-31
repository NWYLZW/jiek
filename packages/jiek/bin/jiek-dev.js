#!/usr/bin/env node
process.env.NODE_ENV = 'test'
require('esbuild-register')
require('../src/index.ts')
