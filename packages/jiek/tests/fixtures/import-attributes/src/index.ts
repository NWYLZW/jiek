import { name as barName } from 'bar/package.json' with { type: 'json' }
import { name as fooName } from 'foo/package.json' with { type: 'json' }
import { name } from 'import-attributes/package.json' with { type: 'json' }

export { barName, fooName, name }

export { name as exportBarName } from 'bar/package.json' with { type: 'json' }
export { name as exportFooName } from 'foo/package.json' with { type: 'json' }

export function foo() {
  console.log(
    import('bar/package.json', { with: { type: 'json' } }),
    // FIXME output is not correct, should be `import('foo/package.json', { with: { type: 'json' } })`
    //       but it is `import('foo/package.json', { assert: { type: 'json' } })`
    import('foo/package.json', { with: { type: 'json' } })
  )
  return 'foo'
}
