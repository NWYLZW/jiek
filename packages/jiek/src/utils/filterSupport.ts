import { getRoot } from '#~/utils/getRoot'
import { getWD } from '#~/utils/getWD'
import type { PackageManagerType } from '#~/utils/getWD'
import { program } from 'commander'
import { load } from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { filterWorkspacePackagesFromDirectory } from 'workspace-sieve'
import type { ProjectManifest } from 'workspace-sieve'

export interface Manifest {
  name?: string
  type?: string
  exports?: string | string[] | Record<string, unknown>
  imports?: Record<string, unknown>
}

export interface ProjectsGraph {
  root?: string
  value?: Record<string, Manifest>
}

export async function filterPackagesGraph(filters: string[]): Promise<ProjectsGraph[]> {
  return Promise.all(filters.map(async filter => getSelectedProjectsGraph(filter)))
}

function resolvePackageMatchPatterns(type: PackageManagerType, workspaceRoot: string) {
  switch (type) {
    case 'npm':
    case 'yarn': {
      const { workspaces } = JSON.parse(
        fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf-8')
      ) as ProjectManifest
      return workspaces
    }
    case 'pnpm':
      const pnpmWorkspaceFilePath = path.resolve(workspaceRoot, 'pnpm-workspace.yaml')
      const pnpmWorkspaceFileContent = fs.readFileSync(pnpmWorkspaceFilePath, 'utf-8')
      const pnpmWorkspace = load(pnpmWorkspaceFileContent) as {
        packages: string[]
      }
      return pnpmWorkspace.packages
    case 'lerna':
      const lernaWorkspaceFilePath = path.resolve(workspaceRoot, 'lerna.json')
      const lernaWorkspaceFileContent = fs.readFileSync(lernaWorkspaceFilePath, 'utf-8')
      const lernaWorkspace = JSON.parse(lernaWorkspaceFileContent) as {
        packages: string[]
      }
      return lernaWorkspace.packages
    default:
      throw new Error('Unrechable code')
  }
}

export async function getSelectedProjectsGraph(
  filter = program.getOptionValue('filter') as string | undefined
): Promise<ProjectsGraph> {
  const { wd, notWorkspace, type } = getWD()
  let root = getRoot()
  if (notWorkspace) {
    return {
      root,
      value: {
        [wd]: JSON.parse(fs.readFileSync(path.resolve(wd, 'package.json'), 'utf-8')) as Manifest
      }
    }
  }

  const workspacePatterns = resolvePackageMatchPatterns(type, wd)

  if (root === wd && (filter == null)) {
    throw new Error('root path is workspace root, please provide a filter')
    // TODO inquirer prompt support user select packages
  }
  if (root === undefined) {
    root = process.cwd()
  }
  if (root !== wd && (filter == null)) {
    const packageJSONIsExist = fs.existsSync(path.resolve(root, 'package.json'))
    if (!packageJSONIsExist) {
      throw new Error('root path is not workspace root, please provide a filter')
    }
    const packageJSON = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8')) as Manifest
    if (packageJSON.name == null) {
      throw new Error('root path is not workspace root, please provide a filter')
    }
    filter = packageJSON.name
  }
  const { matchedGraphics } = await filterWorkspacePackagesFromDirectory(wd, {
    patterns: workspacePatterns,
    filter: [filter ?? '']
  })
  return {
    root,
    value: Object.entries(matchedGraphics)
      .reduce((acc, [key, value]) => {
        acc[value.dirPath] = value.manifest
        return acc
      }, {} as NonNullable<ProjectsGraph['value']>)
  }
}
