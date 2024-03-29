import fs from 'node:fs'
import path from 'node:path'

export function getWorkspaceDir(root = process.cwd()) {
  while (
    root !== '/'
    // windows
    || /^[a-zA-Z]:\\$/.test(root)
  ) {
    const children = fs.readdirSync(root)
    if (children.includes('pnpm-workspace.yaml')) {
      return root
    }
    root = path.dirname(root)
  }
  throw new Error('workspace root not found')
}
