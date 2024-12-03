export * from 'export-self-subpath/base';

var name = "export-self-subpath";
var type = "module";
var version = "0.1.0";
var exports = {
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
	exports: exports,
	devDependencies: devDependencies
};

function foo() {
  return pkg.name;
}

export { foo };
