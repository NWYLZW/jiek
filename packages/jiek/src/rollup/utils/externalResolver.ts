import fs from 'node:fs'
import { builtinModules } from 'node:module'
import process from 'node:process'

const EXCLUDE_SUFFIX = [
  'te?xt',
  'json',
  '(css|s[ac]ss|less|styl)'
]

interface Manifest {
  name?: string
  dependencies?: Record<string, unknown>
  peerDependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
}

export default function(json: Manifest): (string | RegExp)[]
export default function(path?: string): (string | RegExp)[]
export default function(jsonOrPath: string | Manifest = process.cwd()): (string | RegExp)[] {
  const pkg: Manifest = typeof jsonOrPath === 'string'
    ? fs.existsSync(`${jsonOrPath}/package.json`)
      ? JSON.parse(fs.readFileSync(`${jsonOrPath}/package.json`, 'utf-8')) as Manifest
      : {} as Manifest
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
