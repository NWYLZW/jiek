export { name as fooName } from 'foo/package.json';

var name$1 = "bar";

var name = "import-attributes";

declare function foo(): string;

export { name$1 as barName, foo, name };
