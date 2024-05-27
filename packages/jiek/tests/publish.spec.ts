import '../src/commands/base'
import '../src/commands/publish'

import { program } from 'commander'
import { describe, test } from 'vitest'

import { actionFuture } from '../src/inner'
import { prepareROOT } from './prepareROOT'

describe('publish', () => {
  const [, prefixes] = prepareROOT(['base'])
  test('base', () => {
    process.argv = [...prefixes, '--filter', 'test-foo', '-p']
    program.parse(process.argv)
    return actionFuture
  })
})
