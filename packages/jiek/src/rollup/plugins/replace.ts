import { extname } from 'node:path'

import type { Lang, SgNode } from '@ast-grep/napi'
import type { FilterOptions } from 'jiek/rollup-plugin-utils'
import { createFilter, definePlugin } from 'jiek/rollup-plugin-utils'
import MagicString from 'magic-string'

export type Mode = 'string' | 'ast-grep'

export type ReplacementFuncCtx =
  & {
    type: 'transform' | 'renderChunk'
    id: string
    code: string
    mode: Mode
  }
  & (
    | {
      mode?: 'string'
      start: number
      end: number
    }
    | {
      mode?: 'ast-grep'
      $:
        & ((name: string) => string | undefined)
        & ((template: { raw: readonly string[] }) => string | undefined)
      node: SgNode
      lang: Lang
    }
  )

type Falsy = false | null | undefined

export type ReplacementFunc = (ctx: ReplacementFuncCtx) => string | Falsy

export type Replacements = Record<
  string,
  string | Falsy | ReplacementFunc
>

export type ReplaceOptions =
  & FilterOptions
  & {
    /**
     * @default 'string'
     */
    mode?: Mode
    sourcemap?: boolean
    values?: Replacements
  }

export default definePlugin((options: ReplaceOptions = {}) => {
  const {
    include = [/\.[cm]?[tj]sx?$/],
    exclude = [/node_modules/],
    values = {},
    sourcemap
  } = options
  let { mode = 'string' } = options
  const allValues = { ...values }
  const allKeys = Object.keys(allValues)
  const filter = createFilter({ include, exclude })

  const replaceAll = async (ctx: Pick<ReplacementFuncCtx, 'type' | 'id'>, code: string) => {
    const ms = new MagicString(code)
    if (mode === 'string') {
      allKeys.forEach(key => {
        const reg = new RegExp(key, 'g')
        let match
        // eslint-disable-next-line no-cond-assign
        while ((match = reg.exec(code))) {
          const start = match.index
          const end = start + key.length
          const value = typeof allValues[key] === 'function'
            ? allValues[key]({
              ...ctx,
              code,
              start,
              end,
              mode: 'string'
            })
            : allValues[key]
          if (([null, undefined, false] as unknown[]).includes(value)) continue
          ms.overwrite(
            match.index,
            match.index + key.length,
            value as string
          )
        }
      })
    } else if (mode === 'ast-grep') {
      const ext = extname(ctx.id)
      const { parse, Lang } = await import('@ast-grep/napi')
      let lang: Lang | undefined
      if (/[cm]?tsx?/.test(ext)) {
        lang = Lang.TypeScript
      }
      if (/[cm]?jsx?/.test(ext)) {
        lang = Lang.JavaScript
      }
      if (/json?/.test(ext)) {
        lang = Lang.Json
      }
      if (lang == null) return
      const root = parse(lang, code).root()
      allKeys.forEach(key => {
        root
          .findAll(key)
          .forEach(node => {
            const { start, end } = node.range()
            const newValue = typeof allValues[key] === 'function'
              ? allValues[key]({
                ...ctx,
                code,
                mode: 'ast-grep',
                node,
                lang,
                $: (input) => {
                  if (typeof input === 'string') {
                    return node.getMatch(input)?.text()
                  }
                  if ('raw' in input) {
                    return node.getMatch(input.raw[0])?.text()
                  }
                }
              })
              : allValues[key]
            if (([null, undefined, false] as unknown[]).includes(newValue)) return
            ms.overwrite(
              start.index,
              end.index,
              newValue as string
            )
          })
      })
    }
    return ms
  }

  return {
    name: 'jiek:replace',
    buildStart() {
      if (mode === 'ast-grep') {
        try {
          require.resolve('@ast-grep/napi')
          this.warn(
            'You are using `ast-grep` mode, please make sure you have installed `@ast-grep/napi`'
          )
        } catch {
          mode = 'string'
        }
      }
    },
    transform: {
      order: 'pre',
      async handler(code, id) {
        if (allKeys.length === 0) return
        if (filter(id)) return
        const ms = await replaceAll({ type: 'transform', id }, code)
        if (ms == null) return

        return {
          code: ms.toString(),
          map: sourcemap ? ms.generateMap({ hires: true }) : null
        }
      }
    },
    renderChunk: {
      order: 'post',
      async handler(code, { fileName: id }) {
        if (allKeys.length === 0) return
        if (filter(id)) return

        const ms = await replaceAll({ type: 'renderChunk', id }, code)
        if (ms == null) return

        return {
          code: ms.toString(),
          map: sourcemap ? ms.generateMap({ hires: true }) : null
        }
      }
    }
  }
})
