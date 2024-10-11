# Jiek

为什么没有一个在 `monorepo` 下面足够现代又足够简单的构建工具呢？恭喜你发现了宝藏～

## 为什么不使用 X？

- Q: [`tsup`](https://github.com/egoist/tsup)
- A: `tsup` 基于 esbuild 与 rollup，是他们上层的一个 no-config 构建工具
  - 关于类型编译的支持并不足够智能，无法自动找到对应的 `tsconfig.json`，在 `monorepo` 下面会遇到相关的问题
  - 虽然它是声称 no-config，但是在多入口，以及其他的复杂情况下的产物时，仍需要编写相关配置
  - 偏向于使用 cli 中的相关参数，以及配置文件，不够自然
  - 在 `monorepo` 的场景下使用起来进行开发时，在复杂依赖关系的情况下需要管理复杂的构建依赖关系
  - 老牌工具，符合时代背景下的相关需求；沉淀时间久，功能相对来说较为完善；生态较为丰富，网络上的资源较多

- Q: [`unbuild`](https://github.com/unjs/unbuild)
- A: 该工具的底座技术与 `tsup` 也是极为一致，与其不同的便是他的 config 实际上是可以基于 package.json 生成的。
  - 该工具与 `tsup` 一样，存在对：「`monorepo` 支持不好」、「不支持 Project Reference」这些问题
  - 使用的时候你需要根据模版声明输出，再反向根据约定好的规则去创建相关的入口文件，不够自然，也不够灵活过于死板
  - 不过该工具在无配置化上也前进了较大一步，对于一些简单的项目来说，是一个不错的选择

- Q: [`bunchee`](https://github.com/huozhi/bunchee)
- A: 换成了 `swc` + `rollup`，嗯。
  - 同样在 `monorepo` 下有着相关问题，同样没办法处理 Project Reference
  - 定义了一定的 exports 产物到输入文件的规则，能实现一定的灵活性，但是编写导出规则时会过于冗长
  - 没办法在 monorepo 的复杂依赖关系场景中去减轻开发负担

## 安装

目前只支持 pnpm，因为 workspace 的相关机制在 pnpm 的支持是最好的（主要也没时间支持别的工具了）。

```bash
pnpm install -D jiek
```

## Features

### build

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
