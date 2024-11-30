export interface JiekPackageJSONField {
  active: string | string[]
}

/**
 * Union to Intersection
 */
type U2I<T> = (T extends any ? (k: T) => void : never) extends ((k: infer I) => void) ? I : never

type Pretty<T> = {
  [K in keyof T]: T[K]
}

export type JiekPackageJSONFields = keyof JiekPackageJSONField extends infer Keys
  ? Keys extends infer Key ? { [K in `.jiek.${Key}`]?: JiekPackageJSONField[Key] } : never
  : never

export type PackageJson = Pretty<
  U2I<JiekPackageJSONFields> & {
    '.jiek'?: JiekPackageJSONField
    name: string
  }
>

export interface Dependency {
  specifier: string
  version: string
}

export interface Lockfile {
  pnpmfileChecksum: string
  lockfileVersion: string
  settings: Record<string, unknown>
  importers: Record<string, {
    dependencies: Record<string, Record<string, Dependency>>
    devDependencies: Record<string, Record<string, Dependency>>
  }>
}

export interface HookContext {
  log: (message: unknown) => void
}

export interface Pnpmfile {
  hooks: {
    readPackage: (packageJson: PackageJson, context: HookContext) => unknown | Promise<unknown>
    afterAllResolved: (lockfile: Lockfile, context: HookContext) => unknown | Promise<unknown>
  }
}
