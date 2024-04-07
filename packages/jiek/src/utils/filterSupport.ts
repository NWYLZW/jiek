import fs from 'node:fs'
import path from 'node:path'

import { getWorkspaceDir } from '@jiek/utils/getWorkspaceDir'
import { filterPackagesFromDir } from '@pnpm/filter-workspace-packages'
import { program } from 'commander'
import { load } from 'js-yaml'

export let type = ''

try {
  require.resolve('@pnpm/filter-workspace-packages')
  type = 'pnpm'
} catch { /* empty */ }
if (type !== '') {
  program
    .option('-f, --filter <filter>', 'filter packages')
}

interface ProjectsGraph {
  wd: string
  root: string
  value?: Record<string, {
    name?: string
  }>
}

export async function getSelectedProjectsGraph(): Promise<ProjectsGraph> {
  let filter = program.getOptionValue('filter')
  const rootOption = program.getOptionValue('root')
  const root = rootOption
    ? path.isAbsolute(rootOption)
      ? rootOption
      : path.resolve(process.cwd(), rootOption)
    : process.cwd()
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
  if (!notWorkspace && type === 'pnpm') {
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
      wd, root,
      value: Object.entries(selectedProjectsGraph)
        .reduce((acc, [key, value]) => {
          acc[key] = value.package.manifest
          return acc
        }, {} as NonNullable<ProjectsGraph['value']>)
    }
  }
  return {
    wd, root,
    value: {
      [wd]: JSON.parse(fs.readFileSync(path.resolve(wd, 'package.json'), 'utf-8'))
    }
  }
}
