import fs from 'node:fs'
import path from 'node:path'

import type { ViteDevServer } from 'vite'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { globAccept, transformImportGlobAccept } from '#~'

const paths = {
  simpleRoot: path.resolve(__dirname, 'fixtures/simple')
}

describe('transformImportGlobAccept', () => {
  test('transformImportGlobAccept', async () => {
    const importer = path.resolve(paths.simpleRoot, 'src/index.ts')
    const simpleCode = fs.readFileSync(importer, 'utf-8')
    const { files } = await transformImportGlobAccept(
      simpleCode,
      importer,
      paths.simpleRoot,
      id => id
    ) ?? {}
    expect(files).toStrictEqual([
      path.resolve(paths.simpleRoot, 'src/a.ts'),
      path.resolve(paths.simpleRoot, 'src/b.ts')
    ])
  })
})

describe('glob-accept', () => {
  let server: ViteDevServer = null as unknown as ViteDevServer
  beforeAll(async () => {
    server = await createServer({
      root: paths.simpleRoot,
      plugins: [globAccept()]
    })
    await server.listen(15487)
  })
  afterAll(async () => {
    await server.close()
  })
  test('create server', async () => {
    const r = await fetch('http://localhost:15487/src/index.ts', { headers: { 'Accept': 'text/plain' } })
    expect(r.status).toBe(200)
    expect(await r.text()).matchSnapshot()
  })
})
