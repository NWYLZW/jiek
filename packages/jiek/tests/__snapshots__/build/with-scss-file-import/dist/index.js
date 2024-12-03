'use strict';

require('with-scss-file-import/index.css');
require('with-scss-file-import/foo');

function bar() {
  return "bar";
}

exports.bar = bar;
