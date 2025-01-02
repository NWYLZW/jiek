import type { FilterOptions } from 'jiek/rollup-plugin-utils'
import { createFilter, definePlugin } from 'jiek/rollup-plugin-utils'
import MagicString from 'magic-string'

export interface ReplacementFuncCtx {
  type: 'transform' | 'renderChunk'
  id: string
  code: string
  start: number
  end: number
}

export type ReplacementFunc = (ctx: ReplacementFuncCtx) => string

export type Replacements = Record<
  string,
  string | ReplacementFunc
>

export type Options =
  & FilterOptions
  & {
    sourcemap?: boolean
    values?: Replacements
  }

export default definePlugin((options: Options = {}) => {
  const {
    include = [/\.[cm]?[tj]sx?$/],
    exclude = [/node_modules/],
    values = {},
    sourcemap
  } = options
  const allValues = { ...values }
  const allKeys = Object.keys(allValues)
  const filter = createFilter({ include, exclude })

  const replaceAll = (ctx: Pick<ReplacementFuncCtx, 'type' | 'id'>, code: string) => {
    const ms = new MagicString(code)
    allKeys.forEach(key => {
      const reg = new RegExp(key, 'g')
      let match
      // eslint-disable-next-line no-cond-assign
      while ((match = reg.exec(code))) {
        const start = match.index
        const end = start + key.length
        ms.overwrite(
          match.index,
          match.index + key.length,
          typeof allValues[key] === 'function'
            ? allValues[key]({
              ...ctx,
              code,
              start,
              end
            })
            : allValues[key]
        )
      }
    })
    return ms
  }

  return {
    name: 'jiek:replace',
    transform: {
      order: 'pre',
      handler(code, id) {
        if (allKeys.length === 0) return
        if (filter(id)) return
        const ms = replaceAll({ type: 'transform', id }, code)
        if (ms == null) return

        return {
          code: ms.toString(),
          map: sourcemap ? ms.generateMap({ hires: true }) : null
        }
      }
    },
    renderChunk: {
      order: 'post',
      handler(code, { fileName: id }) {
        if (allKeys.length === 0) return
        if (filter(id)) return

        const ms = replaceAll({ type: 'renderChunk', id }, code)
        if (ms == null) return

        return {
          code: ms.toString(),
          map: sourcemap ? ms.generateMap({ hires: true }) : null
        }
      }
    }
  }
})
