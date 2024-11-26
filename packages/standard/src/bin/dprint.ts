/* eslint-disable node/prefer-global/process */
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import { resolve } from 'node:path'

import { mergeWith } from 'lodash-es'

const {
  JIEK_PACKAGE_DIR: packageDir
} = process.env

if (!packageDir) {
  throw new Error('JIEK_PACKAGE_DIR not found in env')
}

const resolveByPackageDir = (path: string) => resolve(packageDir, path)

const logger = fs.createWriteStream(resolveByPackageDir('.dprint.log'), {
  flags: 'a'
})
const log = (...args: any[]) => {
  logger.write(`[${new Date().toLocaleString()}] ${
    args.map(a => {
      if (typeof a === 'object') {
        return JSON.stringify(a)
      }
      return a
    }).join(' ')
  }\n`)
}

const args = process.argv.slice(2)

const binPath = resolveByPackageDir('node_modules/.bin/dprint')

// eslint-disable-next-line no-labels
add_config_file_arg: if (args.length > 0) {
  if (args.findIndex(arg => ['-v', '-V', '-h', '--version', '--help'].includes(arg)) !== -1) {
    // eslint-disable-next-line no-labels
    break add_config_file_arg
  }
  if (
    [
      'help',
      'config'
    ].includes(args[0])
  ) {
    // eslint-disable-next-line no-labels
    break add_config_file_arg
  }
  let pkgConfigPath = resolveByPackageDir('dprint.json')
  const configFileIndex = args.findIndex(arg => arg === '--config' || arg === '-c')
  let config: Record<string, any> | undefined
  // eslint-disable-next-line no-labels
  setConfig: if (configFileIndex !== -1) {
    const configFile = args[configFileIndex + 1]
    if (pkgConfigPath === configFile) {
      // eslint-disable-next-line no-labels
      break setConfig
    }
    if (configFile && fs.existsSync(configFile) && fs.statSync(configFile).isFile() && !configFile.startsWith('-')) {
      config = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
    }
    args.splice(configFileIndex, 2)
  }
  if (config) {
    log('config', config)
    log('pkgConfigPath', pkgConfigPath)
    const mergedConfig = mergeWith(
      config,
      JSON.parse(fs.readFileSync(pkgConfigPath, 'utf-8')),
      (objValue, srcValue) => {
        if (Array.isArray(objValue)) {
          return srcValue.concat(objValue)
        }
      }
    )
    log('mergedConfig', mergedConfig)
    const tempDir = resolveByPackageDir('.temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir)
    }
    pkgConfigPath = resolveByPackageDir(`.temp/.dprint.${Date.now()}.json`)
    fs.writeFileSync(pkgConfigPath, JSON.stringify(mergedConfig, null, 2))
  }
  // TODO merge config file with package config file
  args.unshift('-c', pkgConfigPath)
}

const command = [binPath, ...args].join(' ')
log('command', command)

execSync(command, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
})
