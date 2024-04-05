# Rollup plugin unbundled reexport

```js
import { a } from './utils/a'
import { b } from './utils/b'
import { c } from './utils/c'
import { d } from './utils/d'
import { e } from './utils/e'
import { f } from './utils/f'
import { g } from './utils/g'
```
还在像上面这样写？算了吧，试试这个插件吧！
```js
import { a, b, c, d, e, f, g } from './utils' with { 'unbundled-reexport': 'on' }
```

## 为什么

在 HMR 的使用场景下，我们可能会因为将几个文件的内容合并到一起后重新导出的时候，导致 Rollup 无法正确地识别这个文件的依赖关系，从而导致 HMR 无法正常工作。

所以部分人可能会选择不会将这几个文件的内容合并到一起，而是直接使用这几个文件的路径来导入，从而防止模块依赖关系的混淆。

举一个例子来说：

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

在这个例子中，我们可以看到 a.js 和 b.js 都是直接导入了 utils 这个目录重新导出的捆绑文件，而不是直接导入 foo 和 bar 这两个文件。

现在我们来设想一下如果我们对 utils/foo.js 进行了修改会怎么样？很明显，由于 a.js 和 b.js 都是直接导入了 utils 这个目录重新导出的捆绑文件，所以这俩个文件都会进行热更新，这好吗？显然不好。

## 安装

```bash
npm install --save-dev rollup-plugin-unbundled-reexport
# pnpm
pnpm add -D rollup-plugin-unbundled-reexport
# yarn
yarn add -D rollup-plugin-unbundled-reexport
```

## 使用

一般也只有 vite 才有可能用上，但是如果你的任何一个系统具备 hmr，或许也可以试试。

### 加载插件

* vite
```js
import unbundledReexport from 'rollup-plugin-unbundled-reexport';

export default {
  plugins: [
    unbundledReexport(),
  ],
};
```
* rollup
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


### 进行切割

在这里我们可以使用 [Import Attributes](https://github.com/tc39/proposal-import-attributes) 来触发插件的功能。

```js
import { a, b, c, d, e, f, g } from './utils' with { 'unbundled-reexport': 'on' }
```

暂时不支持 `export * from ''`（等我需要了再来加，稍微有点麻烦）。
* ./utils/index.js
```js
export { a } from './a';
export { b, c, d } from './bcd';
export { e } from './e';
export { f, g } from './fg';
```

你也可以用配置，不用 `with` 语法，写法在类型文件里有，这里就懒得写了😁。

## License

MIT

## 最后

玩的开心！
