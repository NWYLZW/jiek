import { type Foo, foo } from './foo' with { external: 'true' }

export const foofoo = foo + foo
export type FooFoo = typeof foofoo

export { Foo, foo }
