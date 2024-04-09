import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'

import { type } from './filterSupport'
import { getRoot } from './getRoot'

let wd: string
let notWorkspace = false

export function getWD() {
  if (wd) return { wd, notWorkspace }

  const root = getRoot()
  try {
    wd = getWorkspaceDir(root, type)
  } catch (e) {
    // @ts-ignore
    if ('message' in e && e.message === 'workspace root not found') {
      wd = root
      notWorkspace = true
    } else {
      throw e
    }
  }
  return { wd, notWorkspace }
}
