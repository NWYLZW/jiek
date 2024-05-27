import '../src/commands/base'
import '../src/commands/publish'

import { program } from 'commander'
import { describe, test } from 'vitest'

import { actionFuture } from '../src/inner'
import { prepareROOT } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'publish')

describe('publish', () => {
  const [, prefixes] = prepareRootWithSubCmd(['base'])
  test('base', () => {
    process.argv = [...prefixes, '--filter', 'test-foo', '-p']
    program.parse(process.argv)
    return actionFuture
  })
})
