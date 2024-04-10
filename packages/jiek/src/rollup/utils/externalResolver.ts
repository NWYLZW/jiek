export default function () {
  const cwd = process.cwd()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require(`${cwd}/package.json`)
  const { dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = pkg
  const external = <(string | RegExp)[]>Object
    .keys(dependencies)
    .concat(Object.keys(peerDependencies))
    .concat(Object.keys(optionalDependencies))
  return external
    .map(dep => new RegExp(`^${dep}(/.*)?$`))
    .concat([
      /^node:/
    ])
}
