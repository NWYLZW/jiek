import fs from 'node:fs'
import { builtinModules } from 'node:module'

const EXCLUDE_SUFFIX = [
  'te?xt',
  'json',
  '(css|s[ac]ss|less|styl)'
]

export default function(json: Record<string, unknown>): (string | RegExp)[]
export default function(path?: string): (string | RegExp)[]
export default function(jsonOrPath: string | Record<string, unknown> = process.cwd()): (string | RegExp)[] {
  const pkg = typeof jsonOrPath === 'string'
    ? fs.existsSync(`${jsonOrPath}/package.json`)
      ? JSON.parse(fs.readFileSync(`${jsonOrPath}/package.json`, 'utf-8'))
      : {}
    : jsonOrPath
  const { name, dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = pkg
  if (!name) {
    throw new Error('package.json must have a name field')
  }

  const external = <(string | RegExp)[]> Object
    .keys(dependencies)
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
