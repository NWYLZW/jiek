import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { filterPackagesFromDir } from '@pnpm/filter-workspace-packages'
import { program } from 'commander'
import { load } from 'js-yaml'

import { getRoot } from './getRoot'
import { getWD } from './getWD'

export let type = ''

try {
  const require = createRequire(import.meta.url)
  require.resolve('@pnpm/filter-workspace-packages')
  type = 'pnpm'
} catch { /* empty */ }
if (type !== '') {
  program
    .option('-f, --filter <filter>', 'filter packages, support fuzzy match and array. e.g. -f core,utils')
}

export interface ProjectsGraph {
  wd: string
  root: string
  value?: Record<string, {
    name?: string
    type?: string
    exports?: string | string[] | Record<string, unknown>
  }>
}

export function filterPackagesGraph(filters: string[]): Promise<ProjectsGraph[]> {
  return Promise.all(filters.map(async filter => getSelectedProjectsGraph(filter)))
}

export async function getSelectedProjectsGraph(
  filter = program.getOptionValue('filter')
): Promise<ProjectsGraph> {
  const root = getRoot()
  const { wd, notWorkspace } = getWD()
  if (notWorkspace) {
    return {
      wd,
      root,
      value: {
        [wd]: JSON.parse(fs.readFileSync(path.resolve(wd, 'package.json'), 'utf-8'))
      }
    }
  }
  if (type === 'pnpm') {
    const pnpmWorkspaceFilePath = path.resolve(wd, 'pnpm-workspace.yaml')
    const pnpmWorkspaceFileContent = fs.readFileSync(pnpmWorkspaceFilePath, 'utf-8')
    const pnpmWorkspace = load(pnpmWorkspaceFileContent) as {
      packages: string[]
    }
    if (root === wd && !filter) {
      throw new Error('root path is workspace root, please provide a filter')
      // TODO inquirer prompt support user select packages
    }
    if (root !== wd && !filter) {
      const packageJSONIsExist = fs.existsSync(path.resolve(root, 'package.json'))
      if (!packageJSONIsExist) {
        throw new Error('root path is not workspace root, please provide a filter')
      }
      const packageJSON = JSON.parse(fs.readFileSync(path.resolve(root, 'package.json'), 'utf-8'))
      if (!packageJSON.name) {
        throw new Error('root path is not workspace root, please provide a filter')
      }
      filter = packageJSON.name
    }
    const { selectedProjectsGraph } = await filterPackagesFromDir(wd, [{
      filter: filter ?? '',
      followProdDepsOnly: true
    }], {
      prefix: root,
      workspaceDir: wd,
      patterns: pnpmWorkspace.packages
    })
    return {
      wd,
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
