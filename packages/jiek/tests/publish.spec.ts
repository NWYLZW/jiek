import '../src/commands/base'
import '../src/commands/publish'

import { program } from 'commander'
import { describe, test } from 'vitest'

import { actionFuture } from '../src/inner'
import { prepareROOT } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'publish')

describe('base', () => {
  const [, prefixes] = prepareRootWithSubCmd(['base'])
  test('common', () => {
    process.argv = [...prefixes, '--filter', 'test-foo', '-p']
    program.parse(process.argv)
    return actionFuture
  })
})

describe('single package and multiple entries', () => {
  const [, prefixes] = prepareRootWithSubCmd(['single-package-and-multiple-entries'], {
    notWorkspace: true
  })
  test('common', () => {
    process.argv = [...prefixes, '-p']
    program.parse(process.argv)
    return actionFuture
  })
})
