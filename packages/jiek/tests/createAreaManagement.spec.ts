import '#~/polyfill'

import { describe, expect, test } from 'vitest'

import { createAreaManagement } from '#~/commands/utils/createAreaManagement'

describe('createAreaManagement', () => {
  const createHelper = () => {
    const outputLines: string[] = []
    let areaIsUpdated = Promise.withResolvers<void>()
    const updateAndReset = async () => {
      await areaIsUpdated.promise
      areaIsUpdated = Promise.withResolvers<void>()
    }
    const areaManagement = createAreaManagement({
      outputLines,
      onAreaUpdate: () => areaIsUpdated.resolve()
    })
    return { outputLines, updateAndReset, areaManagement }
  }
  test.concurrent('single area', async () => {
    const { outputLines, updateAndReset, areaManagement } = createHelper()
    const area = areaManagement.create()

    area.info('hello')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello'])

    area.info('hello world')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'hello world'])

    area.info('hello world!')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'hello world', 'hello world!'])

    area.info('hello world!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello world', 'hello world!', 'hello world!!'])

    area.info('hello world!!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello world!', 'hello world!!', 'hello world!!!'])

    area.info('hello world!!!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello world!!', 'hello world!!!', 'hello world!!!!'])
  })
  test.concurrent('multiple lines', async () => {
    const { outputLines, updateAndReset, areaManagement } = createHelper()
    const area = areaManagement.create()

    area.info('hello\nworld')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'world'])

    area.info('hello\nworld')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['world', 'hello', 'world'])

    area.info('1\n2\n3')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['1', '2', '3'])

    area.info('1\n2\n3\n4')
    await updateAndReset()
    // 这里有四行，再等一次更新
    await updateAndReset()
    expect(outputLines).to.deep.eq(['2', '3', '4'])
  })
  test.concurrent('multiple areas', async () => {
    const { outputLines, updateAndReset, areaManagement } = createHelper()
    const area0 = areaManagement.create()
    const area1 = areaManagement.create()

    area0.info('hello')
    await updateAndReset()
    area1.info('hello')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'hello'])

    area0.info('hello 0')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'hello 0', 'hello'])

    area1.info('hello 1')
    await updateAndReset()
    expect(outputLines).to.deep.eq(['hello', 'hello 0', 'hello', 'hello 1'])

    area0.info('hello 0 1')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'hello',
      'hello 0',
      'hello 0 1',
      'hello',
      'hello 1'
    ])

    area1.info('hello 1 1')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'hello',
      'hello 0',
      'hello 0 1',
      'hello',
      'hello 1',
      'hello 1 1'
    ])

    area0.info('hello 0 2')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'hello 0',
      'hello 0 1',
      'hello 0 2',
      'hello',
      'hello 1',
      'hello 1 1'
    ])
  })
  test.concurrent('header and footer', async () => {
    const { outputLines, updateAndReset, areaManagement } = createHelper()
    const area = areaManagement.create({
      header: 'header',
      footer: 'footer'
    })

    area.info('hello')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello',
      'footer'
    ])

    area.info('hello world')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello',
      'hello world',
      'footer'
    ])

    area.info('hello world!')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello',
      'hello world',
      'hello world!',
      'footer'
    ])

    area.info('hello world!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello world',
      'hello world!',
      'hello world!!',
      'footer'
    ])

    area.info('hello world!!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello world!',
      'hello world!!',
      'hello world!!!',
      'footer'
    ])

    area.info('hello world!!!!')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header',
      'hello world!!',
      'hello world!!!',
      'hello world!!!!',
      'footer'
    ])
  })
  test.concurrent('header and footer with multiple areas', async () => {
    const { outputLines, updateAndReset, areaManagement } = createHelper()
    const area0 = areaManagement.create({
      header: 'header 0',
      footer: 'footer 0'
    })
    const area1 = areaManagement.create({
      header: 'header 1',
      footer: 'footer 1'
    })

    area0.info('hello 0 0')
    await updateAndReset()
    area1.info('hello 1 0')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 0',
      'footer 0',
      'header 1',
      'hello 1 0',
      'footer 1'
    ])

    area0.info('hello 0 1')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 0',
      'hello 0 1',
      'footer 0',
      'header 1',
      'hello 1 0',
      'footer 1'
    ])

    area1.info('hello 1 1')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 0',
      'hello 0 1',
      'footer 0',
      'header 1',
      'hello 1 0',
      'hello 1 1',
      'footer 1'
    ])

    area0.info('hello 0 2')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 0',
      'hello 0 1',
      'hello 0 2',
      'footer 0',
      'header 1',
      'hello 1 0',
      'hello 1 1',
      'footer 1'
    ])

    area0.info('hello 0 3')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 1',
      'hello 0 2',
      'hello 0 3',
      'footer 0',
      'header 1',
      'hello 1 0',
      'hello 1 1',
      'footer 1'
    ])

    area0.info('hello 0 4')
    await updateAndReset()
    expect(outputLines).to.deep.eq([
      'header 0',
      'hello 0 2',
      'hello 0 3',
      'hello 0 4',
      'footer 0',
      'header 1',
      'hello 1 0',
      'hello 1 1',
      'footer 1'
    ])
  })
})
