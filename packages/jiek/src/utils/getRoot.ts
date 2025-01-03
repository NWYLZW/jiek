import path from 'node:path'
import process from 'node:process'

let root: string | undefined
export function getRoot() {
  if (root != null) return root

  const rootOption = process.env.JIEK_ROOT
  root = rootOption != null
    ? path.isAbsolute(rootOption)
      ? rootOption
      : path.resolve(process.cwd(), rootOption)
    : undefined
  return root
}
