'use strict';

var node_module = require('node:module');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
var require$1 = (
  false
    ? /* @__PURE__ */ node_module.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)))
    : require
);

function foo() {
  return "foo";
}
function bar() {
  return require$1("./bar").bar;
}

exports.bar = bar;
exports.foo = foo;
