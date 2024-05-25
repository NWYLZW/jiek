import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

const dtsfilepath = path.resolve(__dirname, 'tsconfig.dts.json')
const compilerOptionsJson = JSON.parse(fs.readFileSync(dtsfilepath, 'utf8')).compilerOptions
const compilerOptions = {
  ...ts.convertCompilerOptionsFromJson(compilerOptionsJson, __dirname).options,
  declaration: true,
  emitDeclarationOnly: true
}

const files = [
  'src/index.ts',
  'src/b.ts'
].map(p => path.resolve(__dirname, p))

const host = ts.createCompilerHost(compilerOptions, true)
const program = ts.createProgram(files, compilerOptions, host)

console.log(
  program
    .getSourceFiles()
    .map(source => source.fileName)
    .filter(fileName => !fileName.endsWith('.d.ts'))
)
const source = program.getSourceFile(path.resolve(__dirname, 'src/a.ts'))
const result = program.emit(source, (_, text) => {
  console.log({ _, text })
}, undefined, true)
console.log('done', result)
