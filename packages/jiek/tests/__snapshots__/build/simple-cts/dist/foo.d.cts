declare const FooSub = "foo-sub";

declare function foo(): string;

export { FooSub as CJSFooSub, FooSub as CTSFooSub, foo };
