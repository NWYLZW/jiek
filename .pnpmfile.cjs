// @ts-check
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const active = require('./scripts/utils/getActive')
const logger = require('./scripts/utils/logger')

if (!active.includes('all')) {
  const lockfileDir = path.resolve(__dirname, '.jiek-locks')
  if (!fs.existsSync(lockfileDir)) fs.mkdirSync(lockfileDir)

  const tempDir = path.resolve(lockfileDir, '.tmp')
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

  const lockfile = active.length === 0
    ? path.resolve(lockfileDir, 'pnpm-lock.base.yaml')
    : path.resolve(lockfileDir, `pnpm-lock.${active.join(',')}.yaml`)

  const defaultLockFile = path.resolve(__dirname, 'pnpm-lock.yaml')
  const defaultLockFileTemp = path.resolve(
    tempDir,
    `pnpm-lock.${Math.random().toString(36).substring(7)}.tmp.yaml`
  )

  fs.copyFileSync(defaultLockFile, defaultLockFileTemp)
  // cache default lockfile
  if (fs.existsSync(lockfile)) {
    logger.log('Using lockfile:', lockfile)
    fs.copyFileSync(lockfile, defaultLockFile)
  }

  process.on('exit', code => {
    if (code === 0) {
      // save lockfile to cache
      logger.log('Saving lockfile:', lockfile)
      fs.copyFileSync(defaultLockFile, lockfile)
    }
    // restore default lockfile
    fs.copyFileSync(defaultLockFileTemp, defaultLockFile)
    fs.unlinkSync(defaultLockFileTemp)
    if (fs.readdirSync(tempDir).length === 0) {
      fs.rmdirSync(tempDir)
    }
  })
  process.on('SIGINT', () => {
    process.exit(1)
  })
}

module.exports = /** @type {import('./scripts/pnpmfile').Pnpmfile} */ ({
  hooks: {
    async readPackage(packageJson) {
      if (active.includes('all')) return packageJson

      let pkgActive = packageJson['.jiek']?.active ?? packageJson['.jiek.active']
      if (!pkgActive) return packageJson
      if (typeof pkgActive === 'string') pkgActive = [pkgActive]

      const isActive = active.some(x => pkgActive.includes(x))
      if (isActive) return packageJson

      return {}
    },
    async afterAllResolved(resolveContext) {
      return resolveContext
    }
  }
})
