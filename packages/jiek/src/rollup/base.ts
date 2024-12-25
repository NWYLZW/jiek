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

export const BUILDER_TYPE_PACKAGE_NAME_MAP = {
  esbuild: 'rollup-plugin-esbuild',
  swc: 'rollup-plugin-swc3'
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
  /**
   * Auto-detect the builder from the installed dependencies.
   * If the builder is not installed, it will prompt the user to install it.
   * If exists multiple builders, it will fall back to the 'esbuild'.
   *
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
  features?: {
    /**
     * When use esbuild type builder, it will inject `supported.import-attributes` option.
     * When use swc type builder, it will inject `jsc.experimental.keepImportAttributes` option.
     *
     * And it will auto set the rollup output `externalImportAttributes` and `importAttributesKey` options.
     *
     * @default false
     */
    keepImportAttributes?: boolean | 'assert'
  }
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
  /**
   * https://www.npmjs.com/package/@rollup/plugin-inject#usage
   *
   * @example
   * ```js
   * {
   *   // import { Promise } from 'es6-promise'
   *   Promise: [ 'es6-promise', 'Promise' ],
   *
   *   // import { Promise as P } from 'es6-promise'
   *   P: [ 'es6-promise', 'Promise' ],
   *
   *   // import $ from 'jquery'
   *   $: 'jquery',
   *
   *   // import * as fs from 'fs'
   *   fs: [ 'fs', '*' ],
   *
   *   // use a local module instead of a third-party one
   *   'Object.assign': path.resolve( 'src/helpers/object-assign.js' ),
   * }
   * ```
   */
  injects?: Record<string, string | [string, string]>
}
