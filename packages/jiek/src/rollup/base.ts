import type { OutputOptions } from 'rollup'

export type Mapping2ROO<K extends keyof OutputOptions> = OutputOptions[K] | {
  js?: OutputOptions[K]
  dts?: OutputOptions[K]
}

export interface TemplateOptions {
  /**
   * When the user configures type: module, the generated output from entry points that don't
   * have cts as a suffix will automatically include the CJS version.
   * if it is not configured, and the generated output from entry points that do not have mts
   * as a suffix will automatically include the ESM version.
   *
   * @default true
   */
  crossModuleConvertor?: boolean
  output?: {
    /**
     * @default true
     *
     * When minify is set to true, the output will with minified files.
     * When minify is set to 'only-minify', the output will direct output minified files.
     */
    minify?: boolean | 'only-minify'
    /**
     * @default 'dist'
     */
    dir?: Mapping2ROO<'dir'>
    /**
     * @default true
     */
    sourcemap?: Mapping2ROO<'sourcemap'>
    strict?: Mapping2ROO<'strict'>
  }
}

export type RollupProgressEvent =
  | {
    type: 'init'
    data: {
      leafMap: Map<string, string[][]>
      targetsLength: number
    }
  }
  | {
    type: 'debug'
    data: unknown
  }
  | {
    type: 'progress'
    data: {
      // name, path, exportConditions, input
      name: string
      path: string
      exportConditions: string[]
      input: string
      tags?: string[]
      event?: string
      message?: string
    }
  }

declare module 'jiek' {
  export interface Config {
    build?: TemplateOptions & {
      /**
       * Whether to run in silent mode, only active when configured in the workspace root or cwd.
       *
       * @default false
       */
      silent?: boolean
    }
  }
}
