import { type Options, pkger } from '@jiek/pkger'
import type { Manifest } from '@pnpm/workspace.pkgs-graph'

export function mergePackageJson(manifest: Manifest & {
  jiek?: Options
  exports?: unknown | unknown[]
}, cwd: string) {
  const {
    jiek: { inputs: jiekInputs, cwd: _, ...jiek } = {}, exports
  } = manifest
  const inputs = jiekInputs ?? (
    Array.isArray(exports) ? exports : undefined
  )
  return pkger({ inputs, cwd, ...jiek })
}
