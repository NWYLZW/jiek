'use strict';

var package_json = require('foo/package.json');

var name$1 = "bar";
var version = "0.1.0";
var exports$1 = {
	".": "./index.js",
	"./package.json": "./package.json"
};
var _package = {
	name: name$1,
	version: version,
	exports: exports$1
};

var _package$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: _package,
  exports: exports$1,
  name: name$1,
  version: version
});

var name = "import-attributes";

function foo() {
  console.log(
    Promise.resolve().then(function () { return _package$1; }),
    // FIXME output is not correct, should be `import('foo/package.json', { with: { type: 'json' } })`
    //       but it is `import('foo/package.json', { assert: { type: 'json' } })`
    import('foo/package.json')
  );
  return "foo";
}

Object.defineProperty(exports, "fooName", {
  enumerable: true,
  get: function () { return package_json.name; }
});
exports.barName = name$1;
exports.foo = foo;
exports.name = name;
