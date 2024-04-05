import path from 'node:path'

import type { ImportDeclaration } from 'estree'
import type { Plugin } from 'rollup'

export default (matches: (string | RegExp)[] = []): Plugin[] => {
  const reexportImports = new Map<string, string[]>()
  const reexportImportDecls = new Map<string, [ImportDeclaration, idStartWithString: string][]>()
  const reexportImportIdStartWithStringFromMap = new Map<string, string[]>()
  const reexportedModules = new Map<string, undefined | {
    exportedBindings: Record<string, string[]> | null
  }>()
  return [
    {
      name: 'unbundled-reexport',
      resolveId(id, importer) {
        const match = matches.some(m => {
          if (typeof m === 'string') {
            return id === m
          }
          return m.test(id)
        })
        if (!match || !importer) return
        if (!reexportImports.has(importer)) {
          reexportImports.set(importer, [])
        }
        reexportImports.get(importer)?.push(id)
      },
      moduleParsed(info) {
        console.log('moduleParsed', info.id)
        const infoDir = path.dirname(info.id)
        const reexportMap = reexportImportIdStartWithStringFromMap
        if (reexportImports.has(info.id)) {
          if (!info.ast) {
            console.error('no ast', info.id)
            return
          }
          const reexports = reexportImports.get(info.id)
          info.ast.body.forEach(node => {
            if (node.type !== 'ImportDeclaration') return

            const reexport = reexports?.find(r => node.source?.value === r)
            if (!reexport) return

            if (!reexportImportDecls.has(info.id)) {
              reexportImportDecls.set(info.id, [])
            }
            const idStartWithString = path.resolve(infoDir, reexport)
            reexportImportDecls.get(info.id)?.push([node, idStartWithString])

            if (!reexportMap.has(idStartWithString)) {
              reexportMap.set(idStartWithString, [])
            }
            reexportMap.get(idStartWithString)?.push(info.id)
          })
        }
        const reexportImportIdStartWithString = [
          ...reexportMap.keys()
        ].find(s => info.id.startsWith(`${s}.`) || info.id.startsWith(`${s}/index.`))
        if (reexportImportIdStartWithString) {
          const fromImports = reexportMap.get(reexportImportIdStartWithString)
          fromImports?.forEach(fromImport => {
            const moduleInfo = this.getModuleInfo(fromImport)
            if (!moduleInfo) return
            // this.cache.delete(fromImport)
            // this.cache.set(reexportImportIdStartWithString, moduleInfo)
          })
          reexportedModules.set(reexportImportIdStartWithString, {
            exportedBindings: info.exportedBindings
          })
        }
      },
      transform(code, id) {
        if (!reexportImportDecls.has(id)) return
      }
    }
  ]
}
