import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'

import { type } from './filterSupport'
import { getRoot } from './getRoot'

export function getWD() {
  const root = getRoot()
  let notWorkspace = false
  let wd: string
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
