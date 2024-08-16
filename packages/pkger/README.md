# @jiek/Pkger

用于实现无配置的前端打包工具的工具库，提供了根据 Package.json 的 `exports` 字段生成编译产物结构的功能。

## entrypoints2exports

出于尽可能减少 monorepo 的开发成本的考量，我们希望工作空间内部互相引用时不需要反复的重新编译，而是直接引用源码。这样子就可以减少编译时间，提高开发效率。但是发布给用户的时候，我们有需要有一套相应的转化规则来满足我们的需求。

### 单入口

当我们的文件结构相对较为简单时，输入是：

```json
{
  "exports": "./src/index.ts"
}
```

输出是：

```json
{
  "exports": {
    ".": "./dist/index.js"
  }
}
```

### 数组

当我们的文件存在多个时（不建议使用，没办法在开发情况下区分），输入是：

```json
{
  "exports": ["./src/index.ts", "./src/foo.ts"]
}
```

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./foo": "./dist/foo.js"
  }
}
```

### 对象

当我们的文件结构相对较为复杂时，输入是：

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./foo": "./src/foo.ts"
  }
}
```

输出是：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./foo": "./dist/foo.js"
  }
}
```

### 需要携带原始文件

当我们需要携带原始文件时，需要在调用处理函数时传入参数`{ withSource: true }`，输入是：

```json
{
  "exports": "./src/index.ts"
}
```

输出是：

```json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

### CommonJS 与 ESM

如果你的编译产物是特定的某一种模块规范，你可以通过将文件名后缀改为 `.cts` 或 `.mts` 的方式来指定输出的模块规范。输入是：

```json
{
  "exports": {
    "./foo": "./src/foo.cts",
    "./bar": "./src/bar.mts"
  }
}
```

输出是：

```json
{
  "exports": {
    "./foo": {
      "require": "./dist/foo.cjs"
    },
    "./bar": {
      "import": "./dist/bar.mjs"
    }
  }
}
```

### 复杂产物

对于前端项目来说，我们可能还需要提供一些浏览器版本、去除了样式引入、单文件的产物。输入是：

```json
{
  "exports": {
    ".": {
      "browser": "./dist/index.browser.js",
      "default": "./dist/index.ts"
    },
    "./bar": "./src/bar.cts",
    "./no-bundled": "./src/no-bundled.ts"
  }
}
```

```ts
entrypoints2exports(exports, {
  withConditional: {
    bundled: ({ path, src, dist, conditionals }) =>
      conditionals.includes('browser') || src.endsWith('.cts')
        || path.startsWith('./no-bundled')
        ? false
        : dist.replace(/(\.[cm]?js)$/, '.bundled$1')
  }
})
```

输出是：

```json
{
  "exports": {
    ".": {
      "browser": {
        "source": "./dist/index.browser.ts",
        "default": "./dist/index.browser.js"
      },
      "default": {
        "source": "./dist/index.ts",
        "bundled": "./dist/index.bundled.js",
        "default": "./dist/index.js"
      }
    },
    "./bar": {
      "require": "./dist/bar.cjs"
    },
    "./no-bundled": {
      "default": "./dist/no-bundled.js"
    }
  }
}
```
