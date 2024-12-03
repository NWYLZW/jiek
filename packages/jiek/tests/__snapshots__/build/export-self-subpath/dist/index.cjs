'use strict';

var base = require('export-self-subpath/base');

var name = "export-self-subpath";
var type = "module";
var version = "0.1.0";
var exports$1 = {
	"./package.json": "./package.json",
	".": "./src/index.ts",
	"./base": "./src/base.ts"
};
var devDependencies = {
	"export-self-subpath": "file:."
};
var pkg = {
	name: name,
	type: type,
	version: version,
	exports: exports$1,
	devDependencies: devDependencies
};

function foo() {
  return pkg.name;
}

exports.foo = foo;
Object.keys(base).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return base[k]; }
  });
});
