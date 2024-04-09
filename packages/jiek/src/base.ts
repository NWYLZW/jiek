export type InitNamedFunction = (
  argument: string,
  paths: {
    full: string
    relative: string
    basename?: string
  }
) => [name?: string, path?: string]
export type InitNamed =
| InitNamedFunction
| {
  /**
   *
   */
  [key: string]: string | InitNamedFunction
}

export interface Config {
  init?: {
    /**
     * the package.json template file path or file content
     *
     * if it can be parsed as json, it will be parsed
     * if it is a relative file path, it will be resolved to an absolute path based on the current working directory
     * if it is an absolute file path, it will be used directly
     * @default '.jiek.template.package.json'
     */
    template?: string
    /**
     * the readme content
     *
     * $name will be replaced with the package name
     * $license will be replaced with the license
     */
    readme?: string | ((ctx: {
      dir: string
      packageJson: Record<string, any>
    }) => string)
    /**
     * the readme template file path
     * @default '.jiek.template.readme.md'
     */
    readmeTemplate?: string
    bug?: {
      /**
       * @default 'bug_report.yml'
       */
      template?: string
      /**
       * @default ['bug']
       */
      labels?: string[] | ((ctx: {
        name: string
        dir: string
      }) => string[])
    }
    named?: InitNamed
  }
}
