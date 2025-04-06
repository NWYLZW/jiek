import fs from 'fs'
import process from 'node:process'

import path from 'node:path'
import { searchForWorkspaceRoot } from 'workspace-sieve'
import type { ProjectManifest } from 'workspace-sieve'

const ROOT_FILES = ['pnpm-workspace.yaml', 'lerna.json']

const LOCK_FILES = ['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml']

export type PackageManagerType = 'pnpm' | 'yarn' | 'npm' | 'lerna' | 'unknown'

const asserts = {
  isPnpm: (file: string) => {
    return file === 'pnpm-workspace.yaml' || file === 'pnpm-lock.yaml'
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
  // This usecase is to ensure that jiek itself can be passed by unit test
  // Usually user will not trigger this branch
  let root = ''
  if (process.env.JIEK_ROOT) {
    root = path.isAbsolute(process.env.JIEK_ROOT)
      ? process.env.JIEK_ROOT
      : path.join(process.cwd(), process.env.JIEK_ROOT)
  } else {
    root = searchForWorkspaceRoot(process.cwd())
  }

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
      notWorkspace: !packageJSON.workspaces,
      type: asserts.isYarn(lockFile)
        ? 'yarn'
        : asserts.isNpm(lockFile)
        ? 'npm'
        : asserts.isPnpm(lockFile)
        ? 'pnpm'
        : 'unknown'
    }
  } catch {
    return {
      wd: root,
      notWorkspace: true,
      type: 'unknown'
    }
  }
}
