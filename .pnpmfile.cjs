const fs = require('node:fs/promises')

const pkg = require('./package.json')

module.exports = {
  hooks: {
    async readPackage(packageJson) {
      if (packageJson.name === pkg.name) {
        const { devDependencies } = packageJson
        for (const [name, version] of Object.entries(devDependencies)) {
          if (version.startsWith('workspace:')) {
            const path = `./packages/${name}/package.json`
            if (!await fs.access(path).then(() => true).catch(() => false)) {
              console.warn(`Package ${name} not found in workspace`)
              continue
            }
            const manifest = JSON.parse(await fs.readFile(path, 'utf-8'))
            Object.assign(packageJson.devDependencies, manifest.dependencies ?? {})
            console.log(`Added ${name} dependencies to workspace`)
          }
        }
      }
      return packageJson
    }
  }
}
