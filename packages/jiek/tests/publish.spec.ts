import { createDescribe } from './useExec.ts'

const { describe } = createDescribe({
  snapshotTag: 'publish',
  cmdOptions: ['-s']
})

describe('no mono', ({ test }) => {
  test('simple', async ({ exec }) => exec())
}, true)
