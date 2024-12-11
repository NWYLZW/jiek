import { createRequire } from 'node:module';

var require = /* @__PURE__ */ createRequire(import.meta.url);

function foo() {
  return "foo";
}
function bar() {
  return require("./bar").bar;
}

export { bar, foo };
