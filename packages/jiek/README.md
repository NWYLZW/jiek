# Jiek

| zh-Hans
| [en](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/en/README.md)

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> 基于 `package.json` 元数据并适用于 `Monorepo` 的**轻便**工具库编译管理套件。

- [x] 自动推断：基于 `package.json` 的相关字段自动推断出构建规则，减少配置文件的编写，更加轻便与符合标准
  - `exports`：根据入口文件推断构建目标与类型
  - `imports`：定义路径别名，并在构建的时候自动 bundle 进来
  - `type: module`：根据选项智能决定输出文件后缀，不需要考虑 `cjs` 与 `esm` 的适配问题
  - `dependencies`、`peerDependencies`、`optionalDependencies`：自动将符合规则的依赖标记为 `external`
  - `devDependencies`：将标记为开发依赖的 bundle 进对应的最终产物之中
- [ ] 构建工具：支持多种构建工具，无需纠结于用 swc 还是 esbuild 又或者是 tsc
  - [x] `esbuild`
  - [x] `swc`
  - [ ] `typescript`
- [x] 工作空间友好：支持在 pnpm 下的工作空间开发范式
  - [ ] 支持更多的 PM
  - [ ] 更好的工作空间任务流
- [x] 类型定义文件：支持聚合生成类型定义文件
- [x] 监听模式：适配 rollup 的监听模式
- [x] 发布适配：支持同构生成 `package.json` 等相关字段
- [x] CommonJS：产物兼容正在使用 cjs 的用户
- [ ] 插件化
  - [ ] Dotenv：支持 dotenv 配置文件
  - [ ] Replacer：支持替换文件内容

## 安装

```bash
npm i -D jiek
# or
pnpm i -D jiek
# or
yarn add -D jiek
```

## 快速起步

通过一些简单的方式能又快又轻松的生成需要的产物。

- 在 `package.json` 中添加入口文件，这里需要设置为原文件路径。

  你可以在 Node.js 文档中查看更多对于 [exports](https://nodejs.org/api/packages.html#exports) 的相关内容。

```json
{
  ...
  "exports": "./src/index.ts",
  ...
}
```

- 假设你在工作空间下有一个包名字为 `@monorepo/utils` ，那么你可以运行 `jb utils` 来构建这个包。

- 当你完成了开发的相关步骤后，在发布阶段你可以使用 `jk -f utils publish` 来发布你的包，本工具会自动转化并填充 `package.json` 对应的字段。

  你可以添加 `-p/--preview` 参数来预览待发布的 `package.json` 的内容。

## CLI

```text
Usage: jk [options] [command]
```

## 为什么不使用 X？

在这里与 `jiek` 类似的工具有：[tsup](https://github.com/egoist/tsup)、[unbuild](https://github.com/unjs/unbuild)、[bunchee](https://github.com/huozhi/bunchee)、[pkgroll](https://github.com/privatenumber/pkgroll)、[tsdown](https://github.com/sxzz/tsdown)。但是他们都有着一些共同问题没有解决，我们来看看：

- `monorepo` 的支持存在一定的问题，在依赖工作空间其他的包时必须重新编译相关依赖
- 编写入口文件的规则过于繁琐，不够自然
- 无法处理 `tsconfig.json` 中的 `Project Reference` 相关问题
- 根据`conditions`
