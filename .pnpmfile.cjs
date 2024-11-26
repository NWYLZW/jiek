/** @typedef {{
 name: string
}} PackageJson */

/** @typedef {{
 hooks: { readPackage: (packageJson: PackageJson) => unknown | Promise<unknown> }
}} PNPM_CONFIG */

module.exports = /** @type {PNPM_CONFIG} */ ({
  hooks: {
    async readPackage(packageJson) {
      return packageJson
    }
  }
})
