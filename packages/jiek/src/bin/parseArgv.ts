import process from 'node:process'

import { program } from 'commander'

const { argv } = process
const env: Record<string, string> = {}
let isPassThrough = false
const newArgv = argv.filter((arg) => {
  if (isPassThrough) {
    return false
  }
  if (arg === '--') {
    isPassThrough = true
    return false
  }
  const m = /^--env\.(\w+)=(.*)$/.exec(arg)
  if (m) {
    env[m[1]] = m[2]
    return false
  }
  return true
})
for (const [key, value] of Object.entries(env)) {
  process.env[key] = value
}

export default () => program.parse(newArgv)
