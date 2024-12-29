import type { Module } from '#~/rollup/bundle-analyzer'

interface Node {
  id: string
  filename: string
  parent?: Node
}

declare global {
  // @ts-ignore
  // eslint-disable-next-line no-var,vars-on-top
  var React: typeof import('react')
  // eslint-disable-next-line no-var,vars-on-top
  var analyzeModule: Module[]
  interface WindowEventMap {
    'graph:click': CustomEvent<
      | undefined
      | { node: Node }
    >
    'send:filter': CustomEvent<{
      analyzeModule: Module[]
    }>
  }
}

export function Main() {
  const { useState, useMemo, useEffect, useCallback } = React
  const [path, setPath] = useState(() => location.pathname.replace(/^\/ana\/?/, ''))
  const [pkgName, entry] = useMemo(() => {
    const pkgName = /^(@[^/]+\/[^/]+|[^/]+)\/?/.exec(path)?.[1]
    return [
      pkgName,
      (pkgName != null) ? path.replace(`${pkgName}/`, '') : undefined
    ]
  }, [path])
  const push = useCallback((newPath: string) => {
    setPath(newPath)
    document.title = `${document.title.replace(/ - \/.*/, '')} - \/${newPath}`
    history.pushState(null, '', `/ana/${newPath}`)
  }, [])
  const filterModules = useCallback((startWith: string) => {
    const modules = analyzeModule.filter(m => m.filename.startsWith(startWith))
    dispatchEvent(new CustomEvent('send:filter', { detail: { analyzeModule: modules } }))
  }, [])
  useEffect(() => {
    if (path !== '') {
      document.title = `${document.title.replace(/ - \/.*/, '')} - \/${path}`
    } else {
      document.title = document.title.replace(/ - \/.*/, '')
    }
    filterModules(path)
  }, [path, filterModules])
  useEffect(() => {
    const offGraphClick = listen('graph:click', ({ detail }) => {
      if (!detail) return

      let root = detail.node
      while (root.parent) {
        root = root.parent
      }
      if (root.filename === path) return
      push(root.filename)
    })
    return () => {
      offGraphClick()
    }
  }, [push])
  function listen<T extends keyof WindowEventMap>(type: T, listener: (this: Window, ev: WindowEventMap[T]) => any) {
    window.addEventListener(type, listener)
    return () => {
      window.removeEventListener(type, listener)
    }
  }
  return (
    <div
      style={{
        padding: '12px 55px'
      }}
    >
      /
      <select
        style={{
          appearance: 'none',
          border: 'none',
          background: 'none'
        }}
        value={pkgName}
        onChange={e => push(e.target.value)}
      >
        <option value=''>All</option>
        {analyzeModule
          .map(m => /^(@[^/]+\/[^/]+|[^/]+)\/?/.exec(m.filename)?.[1])
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
      </select>
      {pkgName != null && <>
        /
        <select
          style={{
            appearance: 'none',
            border: 'none',
            background: 'none'
          }}
          value={entry}
          onChange={e => push(`${pkgName}/${e.target.value}`)}
        >
          <option value=''>All</option>
          {analyzeModule
            .filter(m => m.filename.startsWith(`${pkgName}/`))
            .map(m => m.filename.replace(`${pkgName}/`, ''))
            .filter((v, i, a) => a.indexOf(v) === i)
            .map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
        </select>
      </>}
    </div>
  )
}
