import * as path from 'node:path'

import { globSync } from 'fast-glob'

type NameTransform = (name: string) => string
type Input = string

export interface Options {
  /**
   * @default 'dist'
   */
  outdir?: string
  /**
   * @default 'src'
   */
  source?: string
  /**
   * @default ['index.ts']
   */
  inputs?: Input[]
  /**
   * @default false
   */
  noIndex?: boolean
  noBrowser?: boolean
  cwd?: string
  nameTransform?: NameTransform | NameTransform[]
  onlyESM?: boolean
  suffix?: {
    /** @default '.umd' */
    cjs?: string
    /** @default '.umd' */
    umd?: string
    /** @default '.esm' */
    esm?: string
    /** @default '.min' */
    min?: string
    /** @default '.ts' */
    types?: '.ts' | '.mts' | '.cts' | (string & {})
  }
}

const SUFFIX: NonNullable<Options['suffix']> = {
  cjs: '.umd',
  umd: '.umd',
  esm: '.esm',
  min: '.min',
  types: '.ts'
} as const

export function inputsResolve(waitResolvingInputs: Input[], options: {
  cwd?: string
  noIndex?: boolean
} = {
  cwd: process.cwd(),
  noIndex: false
}) {
  const inputs = globSync(waitResolvingInputs, { cwd: options.cwd })
  let rest: Input[]
  let resolvedInputs: Record<string, string>
  if (options.noIndex) {
    resolvedInputs = {}
    rest = inputs
  } else {
    const [index, ...r] = inputs
    rest = r
    resolvedInputs = { '.': index }
  }
  for (const input of rest) {
    if (input.startsWith('regexp:')) {
      throw new Error('regexp is not supported yet')
    }
    const [, name] = /(.+?)(\/index)?\.tsx?$/.exec(input) ?? []
    resolvedInputs[name] = input
  }
  return resolvedInputs
}

interface Output {
  types?: string
  main?: string
  module?: string
  unpkg?: string
  jsdelivr?: string
  browser?: string
  typesVersions: Record<string, Record<string, string[]>>
  exports: Record<string, string | {
    types: string
    import: string
    require: string
    'inner-src': string
  }>
}

export function pkger(options: Options): Output {
  const {
    outdir = 'dist',
    source = 'src',
    inputs = ['index.ts'],
    suffix: inputSuffix = {},
    noIndex,
    noBrowser = false,
    cwd = process.cwd(),
    onlyESM = false
  } = options
  if (onlyESM) {
    throw new Error('onlyESM is not supported yet')
  }
  if (outdir.endsWith(path.sep)) {
    throw new Error('outdir should not end with path separator')
  }
  const re = (...p: string[]) => `./${outdir}/${path.join(...p)}`
  const sourceRe = (...p: string[]) => `./${source}/${path.join(...p)}`

  const suffix = Object.assign(
    SUFFIX,
    noBrowser ? { cjs: '' } : {},
    inputSuffix
  )

  const suffixes = {
    end(mode?: 'require') {
      return {
        require: noBrowser ? '.cjs' : '.js',
        default: '.js'
      }[mode ?? 'default']
    },
    umdMin() {
      return `${suffix.umd}${suffix.min}`
    },
    dts() {
      return `.d${suffix.types}`
    }
  }
  const inputsResolved = inputsResolve(inputs, {
    noIndex,
    cwd: path.join(cwd, source)
  })
  const { ['.']: indexPath } = inputsResolved
  let indexRest = {}
  if (indexPath) {
    const index = indexPath.replace(/\.[m|c]?[t|j]sx?$/, '')
    const indexUMDMin = re(`${index}${suffixes.umdMin()}${suffixes.end()}`)
    const browserIndex = noBrowser ? {} : {
      browser: indexUMDMin
    }
    indexRest = {
      types: re(`${index}${suffixes.dts()}`),
      main: re(`${index}${suffix.cjs}${suffixes.end('require')}`),
      module: re(`${index}${suffix.esm}${suffixes.end()}`),
      ...browserIndex
    }
  }
  const exports: Output['exports'] = {
    './package.json': './package.json'
  }
  for (const [name, input] of Object.entries(inputsResolved)) {
    let index = input.replace(/\.[m|c]?[t|j]sx?$/, '')
    if (name !== 'index') {
      index = index.replace(/\/index$/, '')
    }
    const indexESM = re(`${index}${suffix.esm}${suffixes.end()}`)
    const exportsName = name === '.' ? '.' : `./${name}`
    exports[exportsName] = {
      types: re(`${index}${suffixes.dts()}`),
      import: indexESM,
      require: re(`${index}${suffix.cjs}${suffixes.end('require')}`),
      'inner-src': sourceRe(input)
    }
  }
  return {
    ...indexRest,
    typesVersions: {
      '<5.0': { '*': ['*', re('*'), re(`*/index${suffix.esm}${suffixes.dts()}`)] }
    },
    exports
  }
}
