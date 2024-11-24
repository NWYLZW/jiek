import { getWorkspaceDir, isWorkspaceDir } from '@jiek/utils/getWorkspaceDir'

import { type } from './filterSupport'
import { getRoot } from './getRoot'

let wd: string
let notWorkspace = false

export function getWD() {
  if (wd) return { wd, notWorkspace }

  const root = getRoot()
  if (root !== undefined) {
    const isWorkspace = isWorkspaceDir(root, type)
    notWorkspace = !isWorkspace
    wd = root
    return { wd, notWorkspace }
  }
  try {
    wd = getWorkspaceDir(type)
  } catch (e) {
    // @ts-ignore
    if ('message' in e && e.message === 'workspace root not found') {
      wd = root ?? process.cwd()
      notWorkspace = true
    } else {
      throw e
    }
  }
  return { wd, notWorkspace }
}
