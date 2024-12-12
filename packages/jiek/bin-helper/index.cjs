const {
  basename,
  dirname
} = require('node:path')
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
  for (const line of lines) {
    if (
      line === 'Error' || line.includes(' (node:') || line.includes(` (${__filename}`)
    ) {
      continue
    }
    const match = line.match(/\(([^)]+)\)$/)
    if (match) {
      binFilePath = match[1].replace(/:\d+:\d+$/, '')
    }
    break
  }
}

binFilePath = binFilePath ?? process.env.JIEK_BIN__FILEPATH

const packageDir = dirname(dirname(binFilePath))
const binFilename = basename(binFilePath)

process.env.JIEK_PACKAGE_DIR = packageDir
process.env.JIEK_BIN__FILENAME = binFilename
process.env.JIEK_BIN__FILEPATH = binFilePath

require('esbuild-register')
require(`${packageDir}/src/bin/${binFilename.replace(/(\.[cm]?)js$/, '$1ts')}`)
