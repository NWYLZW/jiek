import pkg from 'export-self-subpath/package.json'

export function foo() {
  return pkg.name
}
export * from 'export-self-subpath/base'
