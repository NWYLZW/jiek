const { resolve, dirname } = require('node:path')
const fs = require('node:fs')
const { filterPackagesFromDir } = require('@pnpm/filter-workspace-packages')
/**
 * @type {undefined | ((text: string) => Record<string, any>)}
 */
let load
try {
  load = require('js-yaml').load
} catch (e) {
  load = undefined
}

function getWorkspaceDir() {
  let root = process.cwd()
  while (
    root !== '/'
    // windows
    || /^[a-zA-Z]:\\$/.test(root)
    ) {
    const children = fs.readdirSync(root)
    if (children.includes('pnpm-workspace.yaml')) {
      return root
    }
    root = dirname(root)
  }
  throw new Error('workspace root not found')
}

const wd = getWorkspaceDir()

const pnpmWorkspaceFilePath = resolve(wd, 'pnpm-workspace.yaml')
const pnpmWorkspaceFileContent = fs.readFileSync(pnpmWorkspaceFilePath, 'utf-8')
/**
 * @type {{
 *   packages: string[]
 * }}
 */
const pnpmWorkspace = load?.(pnpmWorkspaceFileContent)

/**
 * @type {Map<string, string>}
 */
const devDeps = new Map()
/**
 * @param name {string}
 */
async function filter(name) {
  const { selectedProjectsGraph } = await filterPackagesFromDir(wd, [{
    filter: name,
    followProdDepsOnly: true
  }], {
    prefix: wd,
    workspaceDir: wd,
    patterns: pnpmWorkspace.packages
  })
  return Object.values(selectedProjectsGraph)[0]
}

/**
 * @param dependencies {Record<string, string>}
 */
async function flatDependencies(dependencies) {
  for (const [name, version] of Object.entries(dependencies)) {
    if (devDeps.has(name)) {
      continue
    }
    devDeps.set(name, version)
    if (version.startsWith('workspace:')) {
      // recursively get package all dependencies
      const { dependencies = [], package: { manifest = {} } = {} } = await filter(name) ?? {}
      if (dependencies.length === 0) continue
      await flatDependencies(manifest.dependencies ?? {})
    }
  }
}

const pkg = require('./package.json')

module.exports = {
  hooks: {
    async readPackage(packageJson) {
      if (packageJson.name !== pkg.name)
        return packageJson
      if (load === undefined) {
        console.warn(
          'js-yaml is not installed,' +
          ' please reinstall all dependencies when this installation is complete.' +
          ' or retrigger install with `pnpm i`'
        )
        return packageJson
      }
      const { devDependencies } = packageJson
      await flatDependencies(devDependencies)
      const append = Object.fromEntries(devDeps)
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        ...append
      }
      console.log(devDeps)
      return packageJson
    }
  }
}
