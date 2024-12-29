import fs from 'node:fs'
import { resolve } from 'node:path'

export const recursiveListFiles = (dir: string): string[] =>
  fs.readdirSync(dir).reduce((acc, file) => {
    const filePath = resolve(dir, file)
    if (fs.statSync(filePath).isDirectory()) {
      if (filePath.endsWith('/node_modules')) return acc

      return [...acc, ...recursiveListFiles(filePath)]
    }
    return [...acc, filePath]
  }, [] as string[])
