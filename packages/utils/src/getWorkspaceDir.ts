import fs from 'node:fs'
import path from 'node:path'

export function isWorkspaceDir(dir: string, type = 'pnpm') {
  if (type !== 'pnpm') {
    throw new Error('TODO, support lerna or yarn workspace')
  }
  return fs.readdirSync(dir).includes('pnpm-workspace.yaml')
}

export function getWorkspaceDir(type = 'pnpm') {
  let dir = process.cwd()
  if (type !== 'pnpm') {
    throw new Error('TODO, support lerna or yarn workspace')
  }
  while (
    dir !== '/'
    // windows
    || /^[a-zA-Z]:\\$/.test(dir)
  ) {
    if (isWorkspaceDir(dir, type)) return dir
    dir = path.dirname(dir)
  }
  throw new Error('workspace root not found')
}
