import { isAbsolute, posix } from 'node:path'

import type { CallExpression, MemberExpression, SequenceExpression } from 'acorn'
import { parseExpressionAt } from 'acorn'
import { findNodeAt } from 'acorn-walk'
import fg from 'fast-glob'
import MagicString from 'magic-string'
import { scan } from 'micromatch'
import type { CustomPluginOptions } from 'rollup'
import { stripLiteral } from 'strip-literal'
import type { PluginOption, ResolvedConfig, TransformResult } from 'vite'
import { normalizePath } from 'vite'

const { join, dirname, basename } = posix

/**
 * Transforms transpiled code result where line numbers aren't altered,
 * so we can skip sourcemap generation during dev
 */
export function transformStableResult(s: MagicString, id: string): TransformResult {
  return {
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id })
  }
}

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

export function isVirtualModule(id: string): boolean {
  // https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
  return id.startsWith('virtual:') || id[0] === '\0' || !id.includes('/')
}

export function getCommonBase(globsResolved: string[]): null | string {
  const bases = globsResolved
    .filter((g) => g[0] !== '!')
    .map((glob) => {
      let { base } = scan(glob)
      // `scan('a/foo.js')` returns `base: 'a/foo.js'`
      if (basename(base).includes('.')) base = dirname(base)

      return base
    })

  if (!bases.length) return null

  let commonAncestor = ''
  const dirS = bases[0].split('/')
  for (let i = 0; i < dirS.length; i++) {
    const candidate = dirS.slice(0, i + 1).join('/')
    if (bases.every((base) => base.startsWith(candidate)))
      commonAncestor = candidate
    else break
  }
  if (!commonAncestor) commonAncestor = '/'

  return commonAncestor
}

function globSafePath(path: string) {
  // slash path to ensure \ is converted to / as \ could lead to a double escape scenario
  // see https://github.com/mrmlnc/fast-glob#advanced-syntax
  return fg.escapePath(normalizePath(path))
}

function lastNthChar(str: string, n: number) {
  return str.charAt(str.length - 1 - n)
}

function globSafeResolvedPath(resolved: string, glob: string) {
  // we have to escape special glob characters in the resolved path, but keep the user specified globby suffix
  // walk back both strings until a character difference is found
  // then slice up the resolved path at that pos and escape the first part
  let numEqual = 0
  const maxEqual = Math.min(resolved.length, glob.length)
  while (
    numEqual < maxEqual &&
    lastNthChar(resolved, numEqual) === lastNthChar(glob, numEqual)
  ) {
    numEqual += 1
  }
  const staticPartEnd = resolved.length - numEqual
  const staticPart = resolved.slice(0, staticPartEnd)
  const dynamicPart = resolved.slice(staticPartEnd)
  return globSafePath(staticPart) + dynamicPart
}

export async function toAbsoluteGlob(
  glob: string,
  root: string,
  importer: string | undefined,
  resolveId: IdResolver
): Promise<string> {
  let pre = ''
  if (glob[0] === '!') {
    pre = '!'
    glob = glob.slice(1)
  }
  root = globSafePath(root)
  const dir = importer ? globSafePath(dirname(importer)) : root
  if (glob[0] === '/') return pre + posix.join(root, glob.slice(1))
  if (glob.startsWith('./')) return pre + posix.join(dir, glob.slice(2))
  if (glob.startsWith('../')) return pre + posix.join(dir, glob)
  if (glob.startsWith('**')) return pre + glob

  const isSubImportsPattern = glob[0] === '#' && glob.includes('*')

  const resolved = normalizePath(
    (await resolveId(glob, importer, {
      custom: { 'vite:import-accept-glob': { isSubImportsPattern } }
    })) || glob
  )
  if (isSubImportsPattern) {
    return join(root, resolved)
  }
  if (isAbsolute(resolved)) {
    return pre + globSafeResolvedPath(resolved, glob)
  }

  throw new Error(
    `Invalid glob: "${glob}" (resolved: "${resolved}"). It must start with '/' or './'`
  )
}

type IdResolver = (
  id: string,
  importer?: string,
  options?: {
    attributes?: Record<string, string>
    custom?: CustomPluginOptions
    isEntry?: boolean
    skipSelf?: boolean
  },
) => Promise<string | undefined> | string | undefined

const importGlobRE = /\bimport\.meta\.hot\.accept(?:<\w+>)?\s*\(/g

const err = (start: number, msg: string) => {
  const e = new Error(`Invalid glob import syntax: ${msg}`)
  ;(e as any).pos = start
  return e
}

export function analyzeImportAst(code: string, start: number) {
  let ast: CallExpression | SequenceExpression | MemberExpression
  let lastTokenPos: number | undefined

  try {
    ast = parseExpressionAt(code, start, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
      onToken: (token) => {
        lastTokenPos = token.end
      }
    }) as any
  } catch (e) {
    const _e = e as any
    if (_e.message && _e.message.startsWith('Unterminated string constant'))
      return undefined!
    if (lastTokenPos == null || lastTokenPos <= start) throw _e

    // tailing comma in object or array will make the parser think it's a comma operation
    // we try to parse again removing the comma
    try {
      const statement = code.slice(start, lastTokenPos).replace(/[,\s]*$/, '')
      ast = parseExpressionAt(
        ' '.repeat(start) + statement, // to keep the ast position
        start,
        {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ranges: true
        }
      ) as any
    } catch {
      throw _e
    }
  }

  const found = findNodeAt(ast as any, start, undefined, 'CallExpression')
  if (!found) throw err(start, `Expect CallExpression, got ${ast.type}`)
  return found.node as unknown as CallExpression
}

export async function parseImportGlobAccept(
  code: string,
  importer: string | undefined,
  root: string,
  resolveId: IdResolver
) {
  let cleanCode
  try {
    cleanCode = stripLiteral(code)
  } catch (e) {
    // skip invalid js code
    return []
  }
  async function resolveMatchedItem(match: RegExpExecArray) {
    const start = match.index!

    const { arguments: args } = analyzeImportAst(code, start)

    if (args.length < 1 || args.length > 2)
      throw err(start, `Expected 1-2 arguments, but got ${args.length}`)

    const arg = args[0]
    if (arg.type !== 'ArrayExpression')
      return
    for (const el of arg.elements) {
      if (el === null) throw err(arg.start, 'Unexpected empty element')
      let value: string | undefined
      if (el.type === 'Literal') {
        if (typeof el.value !== 'string')
          throw err(el.start, 'Expected string literal')
        value = el.value
      }
      if (el.type === 'TemplateLiteral') {
        if (el.expressions.length)
          throw err(el.start, 'TemplateLiteral must be static')
        value = el.quasis[0].value.raw
      }
      if (!value)
        throw err(el.start, 'Expected string literal or TemplateLiteral')
      if (!value.includes('*')) return
    }
    const globs = (arg.elements as { value: string }[]).map(el => el.value)
    const globsResolved = await Promise.all(
      globs.map((glob) => toAbsoluteGlob(glob, root, importer, resolveId))
    )
    return {
      globs,
      globsResolved,
      start: arg.start,
      end: args[1].end,
      callbackRange: args[1].range!
    }
  }
  return Promise.all(
    Array
      .from(cleanCode.matchAll(importGlobRE))
      .map(resolveMatchedItem)
  ).then(<T>(x: (T | undefined)[]) => x.filter(Boolean) as T[])
}

export async function transformImportGlobAccept(
  code: string,
  id: string,
  root: string,
  resolveId: IdResolver
) {
  id = slash(id)
  root = slash(root)
  const isVirtual = isVirtualModule(id)

  const matches = await parseImportGlobAccept(
    code,
    isVirtual ? undefined : id,
    root,
    resolveId
  )
  const matchedFiles = new Set<string>()

  if (!matches.length) return null

  const s = new MagicString(code)
  await Promise.all(matches.map(async ({ globsResolved, start, end, callbackRange }) => {
    const cwd = getCommonBase(globsResolved) ?? root
    const files = (
      await fg(globsResolved, {
        cwd,
        absolute: true,
        ignore: [join(cwd, '**/node_modules/**')]
      })
    )
      .filter((file) => file !== id)
      .sort()

    const paths: string[] = []
    const staticImports: string[] = []

    files.forEach(file => {
      paths.push(`"/@fs/${file}"`)
      matchedFiles.add(file)
    })

    const originalLineBreakCount =
      code.slice(start, end).match(/\n/g)?.length ?? 0
    const lineBreaks =
      originalLineBreakCount > 0
        ? '\n'.repeat(originalLineBreakCount)
        : ''

    const importers = `[${paths.join(', ')}${lineBreaks}]`
    const replacement = `/* #__PURE__ */ ${importers}, (...args) => ${code.slice(
      callbackRange[0],
      callbackRange[1]
    )}.call(this, ...args, ${importers})`
    s.overwrite(start, end, replacement)

    return staticImports
  }))

  return {
    s,
    matches,
    files: Array.from(matchedFiles)
  }
}

export default function globAccept(): PluginOption {
  let config: ResolvedConfig | null = null
  return {
    name: 'replacer',
    enforce: 'pre',
    configResolved: r => (config = r, void 0),
    async transform(code, id) {
      if (config == null) throw new Error('configResolved not called')
      if (!code.includes('import.meta.hot.accept')) return

      const result = await transformImportGlobAccept(
        code,
        id,
        config.root,
        (im, _, options) =>
          this.resolve(im, id, options).then((i) => i?.id || im)
      )
      if (result === null) return

      return transformStableResult(result.s, id)
    }
  }
}
