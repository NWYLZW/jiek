import { describe, test } from 'vitest'

import { prepareROOT, runCommandAndSnapshotDistFiles } from './prepareROOT'

const prepareRootWithSubCmd = prepareROOT.bind(null, 'prepublish')

describe('simple', () => {
  const [root, prefixes] = prepareRootWithSubCmd('simple')
  test('common', runCommandAndSnapshotDistFiles.bind(null, '', root, prefixes, 'dist'))
})
