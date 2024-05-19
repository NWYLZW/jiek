import path from 'node:path'

import { program } from 'commander'

let root: string
export function getRoot() {
  if (root) return root

  const rootOption = program.getOptionValue('root')
  root = rootOption
    ? path.isAbsolute(rootOption)
      ? rootOption
      : path.resolve(process.cwd(), rootOption)
    : undefined
  return root
}
