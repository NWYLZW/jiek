'use strict';

var _foo = require('#foo');

const bar = "bar";

exports.bar = bar;
Object.keys(_foo).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return _foo[k]; }
	});
});
