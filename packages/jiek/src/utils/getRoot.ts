import path from 'node:path'

import { program } from 'commander'

export function getRoot() {
  const rootOption = program.getOptionValue('root')
  return rootOption
    ? path.isAbsolute(rootOption)
      ? rootOption
      : path.resolve(process.cwd(), rootOption)
    : process.cwd()
}
