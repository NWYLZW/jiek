import { createDescribe } from './useExec.ts'

const { describe } = createDescribe({
  base: 'publish',
  snapshotTag: 'publish',
  cmdOptions: ['-s']
})

describe('no mono', ({ test }) => {
  test('simple', async ({ exec }) => {
    await exec({ cmd: 'build', autoSnapDist: false })
    await exec({ cmd: 'prepublish' })
    await exec({ cmd: 'postpublish', autoSnapDist: false })
  })
}, true)
