import '../utils/filterSupport'
import '../commands/base'
import '../commands/build'

import parseArgv from './parseArgv'

import process from 'node:process'

if (process.env.JIEK_BIN__FILENAME === 'build.cjs') {
  parseArgv()
}
