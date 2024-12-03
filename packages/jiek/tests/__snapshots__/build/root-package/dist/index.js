'use strict';

var testMonorepoBar = require('@jiek/test-monorepo-bar');

function foo(a, b) {
  return a + b;
}

const name = "root-package";

exports.foo = foo;
exports.name = name;
Object.keys(testMonorepoBar).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return testMonorepoBar[k]; }
  });
});
