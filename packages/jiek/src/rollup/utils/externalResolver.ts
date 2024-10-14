import fs from 'node:fs'

export default function(json: Record<string, unknown>): (string | RegExp)[]
export default function(path?: string): (string | RegExp)[]
export default function(jsonOrPath: string | Record<string, unknown> = process.cwd()): (string | RegExp)[] {
  const pkg = typeof jsonOrPath === 'string'
    ? fs.existsSync(`${jsonOrPath}/package.json`)
      ? JSON.parse(fs.readFileSync(`${jsonOrPath}/package.json`, 'utf-8'))
      : {}
    : jsonOrPath
  const { name, dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = pkg
  const external = <(string | RegExp)[]> Object
    .keys(dependencies)
    .concat(Object.keys(peerDependencies))
    .concat(Object.keys(optionalDependencies))
    .concat(name)
  return external
    .map(dep => new RegExp(`^${dep}(/.*)?$`))
    .concat([
      /^node:/
    ])
}
