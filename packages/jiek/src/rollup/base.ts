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
