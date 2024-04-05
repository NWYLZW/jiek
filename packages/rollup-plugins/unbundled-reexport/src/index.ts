import fs from 'node:fs'
import path from 'node:path'

import type { ExportDefaultDeclaration, ExportNamedDeclaration, ImportDeclaration, Program } from 'estree'
import type { Plugin } from 'rollup'

function exportBindingsFromModule(body: Program['body']) {
  const exportDecls = body.filter(node => [
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration'
  ].includes(node.type)) as (ExportNamedDeclaration | ExportDefaultDeclaration)[]
  return exportDecls.reduce<Record<string, string[]>>((acc, node) => {
    if (node.type === 'ExportNamedDeclaration') {
      const { specifiers, source } = node
      if (!source || typeof source.value !== 'string') return acc

      return { ...acc, [source.value]: specifiers.map(s => s.exported.name) }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const { declaration } = node
      if (!declaration) return acc

      return { ...acc, default: [declaration.type === 'Identifier' ? declaration.name : 'default'] }
    }
    return acc
  }, {})
}

interface ReexportOptions {
  matches?: (string | RegExp)[]
  /**
   * @default [/node_modules/]
   */
  exclude?: (string | RegExp)[]
}

export default (options: ReexportOptions = {}): Plugin[] => {
  const {
    matches = [],
    exclude = [/node_modules/]
  } = options
  return [
    {
      name: 'unbundled-reexport',
      async transform(code, id) {
        if (exclude.some(e => typeof e === 'string'
          ? id.includes(e)
          : e.test(id))) return
        if (!['.ts', '.tsx', '.js', '.jsx'].some(ext => id.endsWith(ext))) return

        const { body } = this.parse(code)
        const importDecls = body.filter(node => node.type === 'ImportDeclaration') as (
          & ImportDeclaration
          & { start: number, end: number }
        )[]
        const reexportImports = importDecls
          .filter(node => matches.some(m => {
            const { value } = node.source ?? {}
            if (!value || typeof value !== 'string') return false

            return typeof m === 'string'
              ? m === value
              : m.test(value)
          }))
        if (reexportImports.length === 0) return

        const reexportModules = await Promise.all(reexportImports.map(node => {
          const { value } = node.source ?? {}
          if (!value || typeof value !== 'string') return

          return this.resolve(value, id, { skipSelf: true })
        }))
        const reexportExportBindingsList = reexportModules.map(module => {
          const { id: moduleId } = module ?? {}
          if (!moduleId) {
            throw new Error(`Failed to resolve module for reexport: ${moduleId}`)
          }
          const code = this.getModuleInfo(moduleId)?.code
            ?? fs.readFileSync(moduleId, 'utf-8')
          return exportBindingsFromModule(this.parse(code).body)
        })

        let newCode = code
        for (const [index, { specifiers, source, start, end }] of reexportImports.entries()) {
          const reexportExportBindings = reexportExportBindingsList[index]
          if (!reexportExportBindings) continue

          const reexportExportBindingsEntries = Object.entries(reexportExportBindings)
          const pathNameMap = new Map<string, string[]>()
          specifiers.forEach(specifier => {
            const [reexportExportBinding] = reexportExportBindingsEntries
              .find(([, exports]) => exports.includes(specifier.local.name))
              ?? []
            if (!reexportExportBinding) return

            if (typeof source.value !== 'string') return
            let relativePath = path.join(source.value, reexportExportBinding)
            if (!relativePath.startsWith('.')) {
              relativePath = './' + relativePath
            }
            if (!pathNameMap.has(relativePath)) {
              pathNameMap.set(relativePath, [])
            }
            pathNameMap
              .get(relativePath)!
              .push(specifier.local.name)
          })
          const newImports = Array.from(pathNameMap.entries())
            .map(([relativePath, names]) => {
              const importNames = names.join(', ')
              return `import { ${importNames} } from '${relativePath}'`
            })
            .join('\n')
          newCode = newCode.slice(0, start) + newImports + newCode.slice(end)
        }
        return newCode
      }
    }
  ]
}
