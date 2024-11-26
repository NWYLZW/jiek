const {
  JIEK_BIN__FILEPATH: binFilePath
} = process.env

const {
  basename,
  dirname
} = require('node:path')

const packageDir = dirname(dirname(binFilePath))
const binFilename = basename(binFilePath).replace(/(\.[cm]?)js$/, '$1ts')

process.env.JIEK_PACKAGE_DIR = packageDir
process.env.JIEK_BIN__FILENAME = binFilename
process.env.JIEK_BIN__FILEPATH = binFilePath

require('esbuild-register')
require(`${packageDir}/src/bin/${binFilename}`)
