import '../utils/filterSupport'
import '../commands/base'
import '../commands/build'

import process from 'node:process'

import parseArgv from '#~/bin/parseArgv.ts'

if (process.env.JIEK_BIN__FILENAME === 'build.cjs') {
  parseArgv()
}
