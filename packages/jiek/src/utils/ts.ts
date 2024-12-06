import fs from 'node:fs'
import { dirname, resolve } from 'node:path'

import { parse } from 'jsonc-parser'
import { isMatch } from 'micromatch'

interface TSConfig {
  extends?: string | string[]
  compilerOptions?: Record<string, unknown>
  references?: { path: string }[]
  files?: string[]
  include?: string[]
  exclude?: string[]
}

const getTSConfig = (p: string): TSConfig =>
  !fs.existsSync(p) || !fs.statSync(p).isFile()
    ? {}
    : parse(fs.readFileSync(p, 'utf-8'), [], { allowTrailingComma: true, allowEmptyContent: true }) as TSConfig

const getExtendTSConfig = (tsconfigPath: string): TSConfig => {
  tsconfigPath = resolve(tsconfigPath)
  const tsconfigPathDirname = dirname(tsconfigPath)
  const { extends: exts, ...tsconfig } = getTSConfig(tsconfigPath)
  const resolvePaths = (paths: string[] | undefined) => paths?.map(p => resolve(tsconfigPathDirname, p)) ?? []

  const extendsPaths = resolvePaths(
    exts !== undefined ? Array.isArray(exts) ? exts : [exts] : []
  )
  if (extendsPaths.length === 0) return tsconfig
  return extendsPaths
    .map(getExtendTSConfig)
    .concat(tsconfig)
    // https://www.typescriptlang.org/tsconfig/#files:~:text=Currently%2C%20the%20only%20top%2Dlevel%20property%20that%20is%20excluded%20from%20inheritance%20is%20references.
    // Currently, the only top-level property that is excluded from inheritance is references.
    .reduce((acc, { compilerOptions = {}, references: _, ...curr }) => ({
      ...acc,
      ...curr,
      compilerOptions: {
        ...acc.compilerOptions,
        ...compilerOptions
      }
    }), {})
}

export const getCompilerOptionsByFilePath = (
  tsconfigPath: string,
  filePath: string
): Record<string, unknown> | undefined => {
  tsconfigPath = resolve(tsconfigPath)
  filePath = resolve(filePath)
  const tsconfigPathDirname = dirname(tsconfigPath)
  // https://www.typescriptlang.org/tsconfig/#files:~:text=It%E2%80%99s%20worth%20noting%20that%20files%2C%20include%2C%20and%20exclude%20from%20the%20inheriting%20config%20file%20overwrite%20those%20from%20the%20base%20config%20file%2C%20and%20that%20circularity%20between%20configuration%20files%20is%20not%20allowed.
  // It’s worth noting that files, include, and exclude from the inheriting config file overwrite
  // those from the base config file, and that circularity between configuration files is not allowed.
  const tsconfig = getExtendTSConfig(tsconfigPath)

  const resolvePaths = (paths: string[] | undefined) => paths?.map(p => resolve(tsconfigPathDirname, p)) ?? []

  const [
    references,
    files,
    include,
    exclude
  ] = [
    tsconfig.references?.map(({ path }) => path),
    tsconfig.files,
    tsconfig.include,
    tsconfig.exclude
  ].map(resolvePaths)
  if (exclude.length > 0 && exclude.some(i => isMatch(filePath, i))) return

  // when files or include is not empty, the tsconfig should be ignored
  if (tsconfig.files?.length === 0 && tsconfig.include?.length === 0) return
  let isInclude = false
  isInclude ||= files.length > 0 && files.includes(filePath)
  isInclude ||= include.length > 0 && include.some(i => isMatch(filePath, i))
  if (isInclude) {
    return tsconfig.compilerOptions ?? {}
  } else {
    // when files or include is not empty, but the file is not matched, the tsconfig should be ignored
    if (
      (tsconfig.files && tsconfig.files.length > 0)
      || (tsconfig.include && tsconfig.include.length > 0)
    ) return
  }

  references.reverse()
  for (const ref of references) {
    const compilerOptions = getCompilerOptionsByFilePath(ref, filePath)
    if (compilerOptions) return compilerOptions
  }
  return tsconfig.compilerOptions
}
