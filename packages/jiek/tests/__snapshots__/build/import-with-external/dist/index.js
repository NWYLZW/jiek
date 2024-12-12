'use strict';

var foo = require('./foo');

const foofoo = foo.foo + foo.foo;

Object.defineProperty(exports, "foo", {
	enumerable: true,
	get: function () { return foo.foo; }
});
exports.foofoo = foofoo;
