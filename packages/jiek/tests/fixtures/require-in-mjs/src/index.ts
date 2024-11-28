export function foo() {
  return 'foo'
}
export function bar() {
  // eslint-disable-next-line ts/no-require-imports,ts/no-unsafe-return,ts/no-unsafe-member-access
  return require('./bar').bar
}
