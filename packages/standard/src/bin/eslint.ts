/* eslint-disable node/prefer-global/process */
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import * as fs from 'node:fs'

const {
  JIEK_PACKAGE_DIR: packageDir
} = process.env

if (!packageDir) {
  throw new Error('JIEK_PACKAGE_DIR not found in env')
}

const resolveByPackageDir = (path: string) => resolve(packageDir, path)

const args = process.argv.slice(2)

const binPath = resolveByPackageDir('node_modules/.bin/eslint')

// if (args.length > 0) {
//   args.unshift('-c', resolveByPackageDir('.eslintrc.cjs'))
// }

const command = [binPath, ...args].join(' ')

fs.appendFileSync(resolveByPackageDir('.eslint.log'), `command: ${command}\n`, 'utf-8')

try {
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env
    }
  })
} catch (e) {
  fs.appendFileSync(resolveByPackageDir('.eslint.error.log'), `${e}\n`, 'utf-8')
  process.exit(1)
}
