import path from 'node:path'

export function commondir(files: string[], cwd = process.cwd()): string {
  const resolvedFiles = files.map(file => {
    if (path.isAbsolute(file)) return file
    return path.resolve(cwd, file)
  })
  const sep = '/'
  const [first = ''] = resolvedFiles
  const parts = first.split(sep)
  let common = ''
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i]
    if (resolvedFiles.every(file => file.startsWith(common + segment))) {
      common += segment + sep
    } else {
      break
    }
  }
  return common
}
