export const createAreaManagement = (options: {
  outputLines: string[]
  onAreaUpdate?: () => void
  maxSize?: number
}) => {
  const { outputLines } = options
  let i = 0
  const areaSizeList: number[] = []
  function create({
    maxSize: inputMaxSize = options.maxSize ?? 3,
    header,
    footer
  }: {
    maxSize?: number
    header?: string
    footer?: string
  } = {}) {
    const current = i++
    areaSizeList.push(0)
    const waitLogLines = [] as string[]

    let isExited = false
    const noLogLines = Promise.withResolvers<void>()
    const timer = setInterval(() => {
      if (waitLogLines.length === 0) {
        if (isExited) noLogLines.resolve()
        return
      }

      const maxSize = inputMaxSize
        + (header !== undefined ? 1 : 0)
        + (footer !== undefined ? 1 : 0)

      const offset = areaSizeList.reduce((acc, size, index) => {
        if (index < current) {
          return acc + size
        }
        return acc
      }, 0)
      const currentLogLines = [
        ...(header !== undefined ? [header] : []),
        ...waitLogLines.splice(0, maxSize),
        ...(footer !== undefined ? [footer] : [])
      ]
      const curLen = currentLogLines.length
      for (let i = 0; i < curLen; i++) {
        const line = currentLogLines.shift()!
        const areaSize = areaSizeList[current]
        let insertIndex = i
        if (areaSize < maxSize) {
          areaSizeList[current]++
          insertIndex = areaSize
        }
        if (areaSize === maxSize) {
          outputLines.splice(offset, 1)
          insertIndex = maxSize - 1
        }
        outputLines.splice(offset + insertIndex, 0, line)
      }
      options.onAreaUpdate?.()
    }, 10)
    return {
      exit: async () => {
        if (waitLogLines.length !== 0) {
          isExited = true
          await noLogLines.promise
        }
        clearTimeout(timer)
      },
      info: (message: string) => {
        waitLogLines.push(...message.split('\n').filter(s => s.trim() !== ''))
      }
    }
  }
  return { create }
}
