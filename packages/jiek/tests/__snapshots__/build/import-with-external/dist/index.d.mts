declare const foo = "foo";
type Foo = typeof foo;

declare const foofoo: string;
type FooFoo = typeof foofoo;

export { type Foo, type FooFoo, foo, foofoo };
