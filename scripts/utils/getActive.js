// @ts-check
const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const logger = require('./logger')

function findDirActiveConfig(dir = process.cwd()) {
  const activePath = path.resolve(dir, '.jiek-mono-active')
  if (fs.existsSync(activePath)) {
    logger.log('Using active config:', activePath)
    return fs.readFileSync(activePath, 'utf-8')
      .trim()
      .split('\n')
      .map(x => x.trim())
  }
  const pkgPath = path.resolve(dir, 'package.json')
  // eslint-disable-next-line no-labels
  pkg: if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const active = pkg['.jiek']?.active ?? pkg['.jiek.active']

    // eslint-disable-next-line no-labels
    if (!active) break pkg

    logger.log('Using active config from package.json:', pkgPath)
    return Array.isArray(active) ? active : [active]
  }
  if (dir === path.parse(dir).root) {
    return undefined
  }
  return findDirActiveConfig(path.dirname(dir))
}

const {
  JIEK_MONO_ACTIVE
} = process.env

/** @type {string[]} */
const active = (
  JIEK_MONO_ACTIVE
    ? JIEK_MONO_ACTIVE
      ?.split(',')
      ?.map(x => x.trim())
    : findDirActiveConfig()
) ?? []

module.exports = active
