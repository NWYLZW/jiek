import Koa from 'koa'

export const createServer = (port: number, host: string) => {
  const app = new Koa()
  app.listen(port, host)
  const streams = new Map<string, string>()
  app.use(async (ctx) => {
    let stream = streams.get(ctx.path)
    if (stream == null) {
      const maybeKey = streams
        .keys()
        .find(p => ctx.path.startsWith(p))
      stream = maybeKey != null
        ? streams.get(maybeKey)
        : undefined
    }
    if (stream != null) {
      ctx.body = stream
    }
  })
  // noinspection HttpUrlsUsage
  return {
    port,
    host,
    rootUrl: `http://${host}:${port}`,
    renderTo: async (path: string, stream: string) => {
      streams.set(path, stream)
    }
  }
}
