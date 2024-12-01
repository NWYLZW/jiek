'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var testMonorepoBar = require('@jiek/test-monorepo-bar');

function index(a, b) {
  return a + b;
}

exports.default = index;
Object.keys(testMonorepoBar).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return testMonorepoBar[k]; }
  });
});
