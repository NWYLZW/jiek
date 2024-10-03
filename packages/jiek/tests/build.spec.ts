import '../src/commands/base'
import '../src/commands/build'

import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'
import { describe, expect, test } from 'vitest'

import { actionFuture } from '#~/inner.ts'

import { prepareROOT } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'build')

function snapshotDistFiles(distDir: string) {
  const files = fs.readdirSync(distDir, { recursive: true })
  expect(files).toMatchSnapshot()
  files.forEach((file) => {
    if (typeof file !== 'string') return
    expect(`${file}:\n${fs.readFileSync(path.resolve(distDir, file), 'utf-8')}`).toMatchSnapshot()
  })
  fs.rmSync(distDir, { recursive: true })
}

describe('v2', () => {
  describe('simple', () => {
    const [root, prefixes] = prepareRootWithSubCmd(['v2-simple'], {
      notWorkspace: true
    })
    test('common', async () => {
      process.argv = prefixes
      program.parse(process.argv)
      await actionFuture
      snapshotDistFiles(path.resolve(root, 'dist'))
    })
  })
  describe('simple-mjs', () => {
    const [root, prefixes] = prepareRootWithSubCmd(['v2-simple-mjs'], {
      notWorkspace: true
    })
    test('common', async () => {
      process.argv = prefixes
      program.parse(process.argv)
      await actionFuture
      snapshotDistFiles(path.resolve(root, 'dist'))
    })
  })
  describe('multiple-exports', () => {
    const [root, prefixes] = prepareRootWithSubCmd(['v2-multiple-exports'], {
      notWorkspace: true
    })
    test('common', async () => {
      process.argv = prefixes
      program.parse(process.argv)
      await actionFuture
      snapshotDistFiles(path.resolve(root, 'dist'))
    })
  })
})

describe('base', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['base'])
  test('common', async () => {
    process.argv = [...prefixes, '--filter', 'test-foo']
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'packages/foo/dist'))
  })
})
describe('single package and single entry', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['single-package-and-single-entry'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
describe('unordered exports inputs', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['unordered-exports_input'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
describe('single package and multiple entries', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['single-package-and-multiple-entries'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
describe('with no resolve exports', () => {
  const [root, prefixes] = prepareRootWithSubCmd(['with-no-resolve-export'], {
    notWorkspace: true
  })
  test('common', async () => {
    process.argv = prefixes
    program.parse(process.argv)
    await actionFuture
    snapshotDistFiles(path.resolve(root, 'dist'))
  })
})
