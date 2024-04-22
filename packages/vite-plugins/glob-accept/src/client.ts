import type { ModuleNamespace } from 'vite/types/hot.d.ts'

declare module 'vite/types/hot.d.ts' {
  interface ViteHotContext {
    accept(
      deps: readonly string[],
      cb: (mods: Array<ModuleNamespace | undefined>, paths?: string[]) => void
    ): void
  }
}

export default {}
