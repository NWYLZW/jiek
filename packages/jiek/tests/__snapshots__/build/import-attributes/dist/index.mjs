export { name as fooName } from 'foo/package.json' with { type: 'json' };

var name$1 = "bar";
var version = "0.1.0";
var exports = {
	".": "./index.js",
	"./package.json": "./package.json"
};
var _package = {
	name: name$1,
	version: version,
	exports: exports
};

var _package$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: _package,
  exports: exports,
  name: name$1,
  version: version
});

var name = "import-attributes";

function foo() {
  console.log(
    Promise.resolve().then(function () { return _package$1; }),
    // FIXME output is not correct, should be `import('foo/package.json', { with: { type: 'json' } })`
    //       but it is `import('foo/package.json', { assert: { type: 'json' } })`
    import('foo/package.json', { assert: { type: 'json' } })
  );
  return "foo";
}

export { name$1 as barName, foo, name };
