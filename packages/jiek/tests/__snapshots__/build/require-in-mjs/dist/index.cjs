'use strict';

var require$1 = require;

function foo() {
  return "foo";
}
function bar() {
  return require$1("./bar").bar;
}

exports.bar = bar;
exports.foo = foo;
