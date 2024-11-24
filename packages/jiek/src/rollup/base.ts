import type { InputPluginOption, OutputOptions } from 'rollup'

export type Mapping2ROO<K extends keyof OutputOptions> = OutputOptions[K] | {
  js?: OutputOptions[K]
  dts?: OutputOptions[K]
}

export interface ConfigGenerateContext {
  path: string
  name: string
  input: string
  output: string
  external: (string | RegExp)[]
  pkgIsModule: boolean
  conditionals: string[]
}

export type OutputControl = boolean | ((context: ConfigGenerateContext) => boolean)

export const BUILDER_TYPES = ['esbuild', 'swc'] as const

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
  /**
   * @default 'esbuild'
   */
  builder?:
    | typeof BUILDER_TYPES[number]
    | ({
      type: 'esbuild'
    } & import('rollup-plugin-esbuild').Options)
    | ({
      type: 'swc'
    } & import('rollup-plugin-swc3').PluginOptions)
  output?: {
    /**
     * @default true
     *
     * When minify is set to true, the output will with minified files.
     * When minify is set to 'only-minify', the output will direct output minified files.
     */
    minify?: boolean | 'only-minify'
    minifyOptions?:
      | typeof BUILDER_TYPES[number]
      | 'terser'
      | (
        {
          type: 'terser'
        } & import('@rollup/plugin-terser').Options
      )
      | (
        {
          type: 'esbuild'
        } & Parameters<typeof import('rollup-plugin-esbuild').minify>[0]
      )
      | (
        {
          type: 'swc'
        } & Parameters<typeof import('rollup-plugin-swc3').minify>[0]
      )
    /**
     * @default 'dist'
     */
    dir?: Mapping2ROO<'dir'>
    sourcemap?: Mapping2ROO<'sourcemap'>
    strict?: Mapping2ROO<'strict'>
    js?: OutputControl
    dts?: OutputControl
  }
  /**
   * Set the external dependencies of the package.
   */
  external?: (string | RegExp)[]
  plugins?:
    | InputPluginOption
    | ((type: 'js' | 'dts', context: ConfigGenerateContext) => InputPluginOption)
    | {
      js: InputPluginOption
      dts?: InputPluginOption
    }
    | {
      js?: InputPluginOption
      dts: InputPluginOption
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
    type: 'watchChange'
    data: {
      id: string
      name: string
      path: string
      input: string
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
