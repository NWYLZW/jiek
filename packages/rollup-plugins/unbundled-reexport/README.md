# Rollup Plugin Unbundled Reexport

```js
import { a } from './utils/a'
import { b } from './utils/b'
import { c } from './utils/c'
import { d } from './utils/d'
import { e } from './utils/e'
import { f } from './utils/f'
import { g } from './utils/g'
```
Still writing like this? Forget it, try this plugin instead!
```js
import { a, b, c, d, e, f, g } from './utils' with { 'unbundled-reexport': 'on' }
```

## Why Use This Plugin

In the context of using HMR (Hot Module Replacement), when we merge the contents of several files together and re-export them, Rollup may not correctly recognize the dependencies of that file, resulting in HMR not working properly.

Therefore, some people may choose not to merge the contents of these files but instead directly import them using their respective paths to avoid confusion in module dependencies.

Here's an example:

* utils/foo.js
```ts
export declare function foo(): void;
```
* utils/bar.js
```ts
export declare function bar(): void;
```
* utils/index.js
```js
export { foo } from './foo';
export { bar } from './bar';
```
* a.js
```js
import { foo } from './utils';
```
* b.js
```js
import { bar } from './utils';
```

In this example, we can see that a.js and b.js directly import the bundled file exported from the utils directory, rather than importing foo and bar directly.

Now, let's imagine what would happen if we made changes to utils/foo.js? Clearly, since a.js and b.js both directly import the bundled file exported from the utils directory, both files would undergo hot updates. Is this what we want? Obviously not.

## Installation

```bash
npm install --save-dev rollup-plugin-unbundled-reexport
# pnpm
pnpm add -D rollup-plugin-unbundled-reexport
# yarn
yarn add -D rollup-plugin-unbundled-reexport
```

## Usage

Usually, only Vite might make use of this plugin, but if any of your systems support HMR, you can give it a try as well.

### Loading the Plugin

* Vite
```js
import unbundledReexport from 'rollup-plugin-unbundled-reexport';

export default {
  plugins: [
    unbundledReexport(),
  ],
};
```
* Rollup
```js
import unbundledReexport from 'rollup-plugin-unbundled-reexport';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'esm',
  },
  plugins: [
    unbundledReexport(),
  ],
};
```

### Performing Splitting

Here, we can use [Import Attributes](https://github.com/tc39/proposal-import-attributes) to trigger the plugin's functionality.

```js
import { a, b, c, d, e, f, g } from './utils' with { 'unbundled-reexport': 'on' }
```

Currently, \`export * from ''\` is not supported (I'll add it if needed, as it's a bit complicated).
* ./utils/index.js
```js
export { a } from './a';
export { b, c, d } from './bcd';
export { e } from './e';
export { f, g } from './fg';
```

You can also use configuration instead of the \`with\` syntax. The specific syntax can be found in the type file, but I'm too lazy to write it here. 😁

## License

MIT

## Finally

Have fun playing around with it!
