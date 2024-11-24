import path from 'node:path'

let root: string | undefined
export function getRoot() {
  if (root) return root

  const rootOption = process.env.JIEK_ROOT
  root = rootOption
    ? path.isAbsolute(rootOption)
      ? rootOption
      : path.resolve(process.cwd(), rootOption)
    : undefined
  return root
}
