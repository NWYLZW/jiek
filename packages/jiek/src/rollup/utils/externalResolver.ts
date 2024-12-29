import fs from 'node:fs'
import { builtinModules } from 'node:module'
import process from 'node:process'

const EXCLUDE_SUFFIX = [
  'te?xt',
  'json',
  '(css|s[ac]ss|less|styl)'
]

export interface PackageJSON {
  name: string
  type?: string
  bin?: string | Record<string, string>
  exports?: Record<string, unknown> | string | string[]
  imports?: Record<string, unknown>
  dependencies?: Record<string, unknown>
  peerDependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
}

export default function(json: PackageJSON): (string | RegExp)[]
export default function(path?: string): (string | RegExp)[]
export default function(jsonOrPath: string | PackageJSON = process.cwd()): (string | RegExp)[] {
  const pkg: PackageJSON = typeof jsonOrPath === 'string'
    ? fs.existsSync(`${jsonOrPath}/package.json`)
      ? JSON.parse(fs.readFileSync(`${jsonOrPath}/package.json`, 'utf-8')) as PackageJSON
      : {} as PackageJSON
    : jsonOrPath
  const { name, dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = pkg
  if (name == null) {
    throw new Error('package.json must have a name field')
  }

  const external = (<(string | RegExp)[]> [])
    .concat(Object.keys(dependencies))
    .concat(Object.keys(peerDependencies))
    .concat(Object.keys(optionalDependencies))
    .concat(builtinModules)

  return [...new Set(external)]
    .map(dep => new RegExp(`^${dep}(/.*)?$`))
    .concat([
      new RegExp(`^${name}(/.*)?(?<!${EXCLUDE_SUFFIX.map(suffix => `\\.${suffix}`).join('|')})$`),
      /^node:/
    ])
}
