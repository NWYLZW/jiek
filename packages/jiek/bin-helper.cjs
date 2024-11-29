const process = require('node:process')

/**
 * @type {string | undefined}
 */
let binFilePath

try {
  // eslint-disable-next-line unicorn/error-message
  throw new Error()
} catch (e) {
  const { stack } = e
  const lines = stack.split('\n')
  const caller = lines[lines.length - 1]
  const match = caller.match(/\(([^)]+)\)$/)
  if (match) {
    binFilePath = match[1].replace(/:\d+:\d+$/, '')
  }
}

binFilePath = binFilePath ?? process.env.JIEK_BIN__FILEPATH

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
