import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { program } from 'commander'
import { load } from 'js-yaml'

import { getRoot } from '#~/utils/getRoot'
import { getWD } from '#~/utils/getWD'

export let type = ''

try {
  require.resolve('@pnpm/filter-workspace-packages')
  type = 'pnpm'
} catch { /* empty */ }

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

export async function getSelectedProjectsGraph(
  filter = program.getOptionValue('filter') as string | undefined
): Promise<ProjectsGraph> {
  const { wd, notWorkspace } = getWD()
  let root = getRoot()
  if (notWorkspace) {
    return {
      root,
      value: {
        [wd]: JSON.parse(fs.readFileSync(path.resolve(wd, 'package.json'), 'utf-8')) as Manifest
      }
    }
  }
  if (type === 'pnpm') {
    const pnpmWorkspaceFilePath = path.resolve(wd, 'pnpm-workspace.yaml')
    const pnpmWorkspaceFileContent = fs.readFileSync(pnpmWorkspaceFilePath, 'utf-8')
    const pnpmWorkspace = load(pnpmWorkspaceFileContent) as {
      packages: string[]
    }
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
    const { filterPackagesFromDir } = await import('@pnpm/filter-workspace-packages')
    const { selectedProjectsGraph } = await filterPackagesFromDir(wd, [{
      filter: filter ?? '',
      followProdDepsOnly: true
    }], {
      prefix: root,
      workspaceDir: wd,
      patterns: pnpmWorkspace.packages
    })
    return {
      root,
      value: Object.entries(selectedProjectsGraph)
        .reduce((acc, [key, value]) => {
          acc[key] = value.package.manifest
          return acc
        }, {} as NonNullable<ProjectsGraph['value']>)
    }
  }
  throw new Error(`not supported package manager ${type}`)
}
