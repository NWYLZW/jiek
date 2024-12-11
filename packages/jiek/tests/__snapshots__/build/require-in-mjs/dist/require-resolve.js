import { createRequire } from 'node:module';

var require = /* @__PURE__ */ createRequire(import.meta.url);

const resolvedBarPath = require.resolve("./bar");

export { resolvedBarPath };
