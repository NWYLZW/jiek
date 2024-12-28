const fs = require('node:fs')
const {
  basename,
  dirname,
  resolve
} = require('node:path')
const process = require('node:process')

/**
 * @type {string | undefined}
 */
const binFilePath = process.env.JIEK_BIN__FILEPATH ?? module.parent.filename ?? require.main.filename

const packageDir = dirname(dirname(binFilePath))
const binFilename = basename(binFilePath)

process.env.JIEK_PACKAGE_DIR = packageDir
process.env.JIEK_BIN__FILENAME = binFilename
process.env.JIEK_BIN__FILEPATH = binFilePath

const resolveByPKG = (...paths) => resolve(packageDir, ...paths)
const isProduction = fs.existsSync(resolveByPKG(`./.jiek-production-tag`))

if (!isProduction) {
  require('esbuild-register')
}

const binPath = isProduction
  ? resolveByPKG(`./dist/bin/${binFilename}`)
  : resolveByPKG(`./src/bin/${binFilename.replace(/(\.[cm]?)js$/, '$1ts')}`)
require(binPath)
