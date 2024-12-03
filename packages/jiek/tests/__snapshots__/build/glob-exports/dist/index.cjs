'use strict';

var bar = require('glob-exports/sub/bar');
var foo = require('glob-exports/sub/foo');



Object.keys(bar).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return bar[k]; }
	});
});
Object.keys(foo).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return foo[k]; }
	});
});
