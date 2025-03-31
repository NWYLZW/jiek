import fs from 'fs'
import process from 'node:process'

import path from 'node:path'
import { searchForWorkspaceRoot } from 'workspace-sieve'
import type { ProjectManifest } from 'workspace-sieve'

const ROOT_FILES = ['pnpm-workspace.yaml', 'lerna.json']

const LOCK_FILES = ['yarn.lock', 'package-lock.json']

export type PackageManagerType = 'pnpm' | 'yarn' | 'npm' | 'lerna' | 'unknown'

const asserts = {
  isPnpm: (file: string) => {
    return file === 'pnpm-workspace.yaml'
  },
  isLerna: (file: string) => {
    return file === 'lerna.json'
  },
  isYarn: (file: string) => {
    return file === 'yarn.lock'
  },
  isNpm: (file: string) => {
    return file === 'package-lock.json'
  }
}

export interface GetWDResult {
  wd: string
  notWorkspace: boolean
  type: PackageManagerType
}

export function getWD(): GetWDResult {
  const root = searchForWorkspaceRoot(process.cwd())
  for (const file of ROOT_FILES) {
    if (fs.existsSync(path.join(root, file))) {
      return {
        wd: root,
        notWorkspace: false,
        type: asserts.isPnpm(file) ? 'pnpm' : asserts.isLerna(file) ? 'lerna' : 'unknown'
      }
    }
  }

  let lockFile: string = ''

  for (const file of LOCK_FILES) {
    if (fs.existsSync(path.join(root, file))) {
      lockFile = file
      break
    }
  }

  try {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as ProjectManifest
    return {
      wd: root,
      notWorkspace: !!packageJSON.workspaces,
      type: asserts.isYarn(lockFile) ? 'yarn' : asserts.isNpm(lockFile) ? 'npm' : 'unknown'
    }
  } catch {
    return {
      wd: root,
      notWorkspace: true,
      type: asserts.isYarn(lockFile) ? 'yarn' : asserts.isNpm(lockFile) ? 'npm' : 'unknown'
    }
  }
}
