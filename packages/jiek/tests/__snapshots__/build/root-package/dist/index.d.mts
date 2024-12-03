export * from '@jiek/test-monorepo-bar';

declare function foo(a: number, b: string): string;

declare const name = "root-package";

export { foo, name };
