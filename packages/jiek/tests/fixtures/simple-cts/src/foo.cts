import { FooSub as CJSFooSub } from './foo.sub.cjs'
import { FooSub as CTSFooSub } from './foo.sub.cts'

export { CJSFooSub, CTSFooSub }

export function foo() {
  return 'foo'
}
