import { createRequire } from 'node:module';

var require$1 = (
  true
    ? /* @__PURE__ */ createRequire(import.meta.url)
    : require
);

function foo() {
  return "foo";
}
function bar() {
  return require$1("./bar").bar;
}

export { bar, foo };
