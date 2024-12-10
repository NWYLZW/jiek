'use strict';

const FooSub = 'foo-sub';

function foo() {
  return 'foo'
}

exports.CJSFooSub = FooSub;
exports.FooSub = FooSub;
exports.foo = foo;
