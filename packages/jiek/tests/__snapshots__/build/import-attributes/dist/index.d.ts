export { name as aExportFooName, name as bExportFooName, name as exportFooName, name as fooName } from 'foo/package.json';

var name$1 = "bar";

var name = "import-attributes";

declare function foo(): string;

export { name$1 as barName, name$1 as exportBarName, foo, name };
