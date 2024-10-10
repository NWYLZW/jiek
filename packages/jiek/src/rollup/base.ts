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
