export const getInternalModuleName = (pkgName: string) => (`${
  (
    pkgName.startsWith('@') ? pkgName : `@${pkgName}`
  ).replace('/', '+')
}/__internal__`)
