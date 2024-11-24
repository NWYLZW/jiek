# Jiek

| zh-Hans | [en](./.about/en/README.md) |

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> 基于 `package.json` 元数据并适用于 `Monorepo` 的**轻便**工具库编译管理套件。

- 自动推断：基于 `package.json` 的相关字段自动推断出构建规则
  - `exports`：根据入口文件推断构建目标与类型
  - `imports`：定义路径别名，并在构建的时候自动 bundle 进来
  - `type: module`：根据选项智能决定输出文件后缀，不需要考虑 `cjs` 与 `esm` 的适配问题
  - `dependencies`、`peerDependencies`、`optionalDependencies`：自动将符合规则的依赖标记为 `external`
  - `devDependencies`：将标记为开发依赖的 bundle 进对应的最终产物之中
- 工作空间友好：支持在 pnpm 下的工作空间
- 类型定义文件：支持聚合生成类型定义文件
- 监听模式：适配 rollup 的监听模式
- 发布适配：支持同构生成 `package.json` 等相关字段

## 安装

```bash
npm i -D jiek
# or
pnpm i -D jiek
# or
yarn add -D jiek
```

## 使用

### 构建

写构建脚本一直不是一件简单的事情，那么怎么把一个复杂的事情变简单呢？我们可以回到需求的本身，那就是「定义什么便构建什么」。在这里我们用自然的方式来定义构建产物，而不需要去多写一行多余的代码。

> 在这里你需要了解足够先进和现代的「[模块管理]()」以及「[导出策略]()」，在这里我们便是基于这俩点达成的一些自然而然的约定来实现的减轻负担。

接下来我们可以一步步的来看看我们的构建工具是如何工作的。

#### 定义入口

在这里我们可以简单的对 exports 进行一定的扩展，在这里我们把我们定义在 `package.json` 中的 `exports` 字段可以看作为我们的入口文件。在这里我们简单定义一个入口：

```json
{
  "exports": "./src/index.ts"
}
```

是不是很简单呢？没感觉？那你得试试其他的工具了，如果你不了解其他的工具，在这里我示范一段其他的工具你需要定义的：

<details>

```json
{
  "type": "module",
  "exports": {
    "import": {
      "types": "./dist/es/index.d.mts",
      "default": "./dist/es/index.mjs"
    },
    "require": {
      "types": "./dist/cjs/index.d.ts",
      "default": "./dist/cjs/index.js"
    }
  }
}
```

</details>

> 在这里你肯定想问如果你有复杂的导出呢？或者说多个入口呢？在[这里](../pkger/README.md)你可以看到我们的工具的生成规则。

#### 运行指令

假设你有一个 pakcages 下面的包叫 `@monorepo/utils` ，那么你可以这样运行：

```shell
jiek build -f utils
```

是不是很简单呢？在这里我们只需要告诉工具我们的包名就可以了，其他的事情我们都不需要关心。

#### 个性化需求

我知道，你肯定想定义一些自己的东西，你可以在你的根目录或者包的根目录下面创建一个 `jiek.config.ts` 文件：

```typescript
import { defineConfig } from 'jiek'

export default defineConfig({
  build: {
    output: 'lib'
  }
})
```

#### 幕后的故事

一些关于本工具的设计思路和实现细节，不阅读也不会影响各位的使用，感兴趣的各位可以看看。

- 入口的约定：还没写好
- 插件的抉择：还没写好

#### 补充内容

- 关于样式
- 关于类型
- 关于 `monorepo`

#### 接下来要做的

- [ ] 支持更多的 PM
- [ ] 工作空间构建流
- [ ] 依赖分析工具
  - 本次构建哪些在 package 中声明的依赖没用用到，可以移除（提供配置关闭该警告）
  - 针对构建产物的依赖关系生成关系图（可配置颗粒度为文件或者导出方法）

### 发布

## 为什么不使用 X？

在这里与 `jiek` 类似的工具有：[`tsup`](https://github.com/egoist/tsup)、[`unbuild`](https://github.com/unjs/unbuild)、[`bunchee`](https://github.com/huozhi/bunchee)、[`pkgroll`](https://github.com/privatenumber/pkgroll)、[`tsdown`](https://github.com/sxzz/tsdown)。但是他们都有着一些共同问题没有解决，我们来看看：

- `monorepo` 的支持存在一定的问题，在依赖工作空间其他的包时必须重新编译相关依赖
- 编写入口文件的规则过于繁琐，不够自然
- 无法处理 `tsconfig.json` 中的 `Project Reference` 相关问题
- 根据`conditions`
