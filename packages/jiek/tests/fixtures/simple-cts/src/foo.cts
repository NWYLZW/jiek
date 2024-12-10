import { FooSub as CJSFooSub } from './foo.sub.cjs'
import { FooSub } from './foo.sub.cts'

export { CJSFooSub, FooSub }

export function foo() {
  return 'foo'
}
