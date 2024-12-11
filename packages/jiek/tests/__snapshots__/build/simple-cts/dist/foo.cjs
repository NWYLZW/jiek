'use strict';

const FooSub = "foo-sub";

function foo() {
  return "foo";
}

exports.CJSFooSub = FooSub;
exports.CTSFooSub = FooSub;
exports.foo = foo;
