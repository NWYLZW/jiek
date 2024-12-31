import { createDescribe } from './useExec.ts'

const { describe } = createDescribe({
  base: 'publish',
  snapshotTag: 'publish',
  cmdOptions: ['-s']
})

describe('no mono', ({ test }) => {
  test('simple', async ({ exec }) => {
    await exec({ cmd: 'build', autoSnapDist: false })
    try {
      await exec({ cmd: 'prepublish' })
    } finally {
      await exec({ cmd: 'postpublish', autoSnapDist: false })
    }
  })
  test('subpath', async ({ exec }) => {
    await exec({ cmd: 'build', autoSnapDist: false })
    try {
      await exec({ cmd: 'prepublish' })
    } finally {
      await exec({ cmd: 'postpublish', autoSnapDist: false })
    }
  }, 10000)
}, true)
