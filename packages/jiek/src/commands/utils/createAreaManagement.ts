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
    const hasHeader = header !== undefined
    const hasFooter = footer !== undefined
    areaSizeList.push(hasHeader ? 1 : 0)
    const waitLogLines = [] as string[]

    let isExited = false
    const noLogLines = Promise.withResolvers<void>()
    const update = () => {
      if (waitLogLines.length === 0) {
        if (isExited) noLogLines.resolve()
        return
      }

      const maxSize = inputMaxSize
        + (hasHeader ? 1 : 0)
        + (hasFooter ? 1 : 0)

      const offset = areaSizeList.reduce((acc, size, index) => {
        if (index < current) {
          return acc + size
        }
        return acc
      }, 0)
      const contentLogLines = waitLogLines.splice(0, maxSize)
      const currentLogLines = [
        ...(hasHeader ? [header] : []),
        ...contentLogLines,
        ...(hasFooter ? [footer] : [])
      ]
      const curLen = currentLogLines.length
      if (hasFooter && curLen > 0) {
        const prevAreaSize = areaSizeList[current]
        areaSizeList[current] -= outputLines.splice(offset + prevAreaSize - 1, 1).length
      }
      for (let i = 0; i < curLen; i++) {
        const isHeader = hasHeader && i === 0
        const line = currentLogLines.shift()!
        const areaSize = areaSizeList[current]
        let insertIndex = i
        if (areaSize < maxSize) {
          insertIndex = areaSize - (hasFooter ? 1 : 0)
          if (!isHeader) {
            areaSizeList[current]++
          }
        }
        if (areaSize === maxSize) {
          outputLines.splice(
            offset + (hasHeader ? 1 : 0),
            1
          )
          insertIndex = maxSize - 1
        }
        if (isHeader) {
          outputLines[offset] = line
        } else {
          insertIndex += hasHeader ? 1 : 0
          outputLines.splice(
            offset + insertIndex,
            0,
            line
          )
        }
      }
      options.onAreaUpdate?.()
    }
    const timer = setInterval(update, 10)
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
      },
      setHeader: (newHeader: string) => {
        if (header == null) {
          throw new Error('You can only set header when header is already, use create({ header: "header" })')
        }
        header = newHeader
        update()
      },
      setFooter: (newFooter: string) => {
        if (footer == null) {
          throw new Error('You can only set footer when footer is already, use create({ footer: "footer" })')
        }
        footer = newFooter
        update()
      }
    }
  }
  return { create }
}
