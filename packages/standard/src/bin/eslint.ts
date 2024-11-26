/* eslint-disable node/prefer-global/process */
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import { resolve } from 'node:path'

const {
  JIEK_PACKAGE_DIR: packageDir
} = process.env

if (!packageDir) {
  throw new Error('JIEK_PACKAGE_DIR not found in env')
}

const resolveByPackageDir = (path: string) => resolve(packageDir, path)

const logger = fs.createWriteStream(resolveByPackageDir('.eslint.log'), {
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

const binPath = resolveByPackageDir('node_modules/.bin/eslint')

log('args:', args)
if (args.length > 0) {
  args.unshift('-c', resolveByPackageDir('eslint.config.mjs'))
}

const command = [binPath, ...args].join(' ')
log('command', command)

execSync(command, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
})
