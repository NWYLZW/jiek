'use strict';

var foo = require('simple-cts/foo');



Object.keys(foo).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return foo[k]; }
	});
});
