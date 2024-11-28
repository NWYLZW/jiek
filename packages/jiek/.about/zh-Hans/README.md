# Jiek

| 简体中文
| [繁体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hant/README.md)
| [日本語](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/ja/README.md)
| [Français](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/fr/README.md)
| [English](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/README.md)

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
  - [ ] 根据 `package.json` 中的路径自动替换 README.md 中的相对路径链接为对应的网络链接
  - [ ] 根据仓库、项目自动生成通用字段，如 `license`、`author`、`homepage`、`repository` 等
  - [ ] 合并 `package.jk.json` 到即将发布的 `package.json` 中
- [x] CommonJS：产物兼容正在使用 cjs 的用户
- [ ] 插件化
  - [ ] Dotenv：支持 dotenv 配置文件
  - [ ] Replacer：支持替换文件内容
- [ ] 钩子：prepublish、postpublish
  - [ ] 自动生成 changelog
  - [ ] 自动决定下一个版本号
    - [ ] `feat: xxx` -> `patch`
    - [ ] `feat!: xxx` -> `minor`
    - [ ] `feat!!: xxx` -> `major`

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

- 假设你在工作空间下有一个包名字为 `@monorepo/utils` ，那么你可以运行 `jk -f utils build` 来构建这个包。

- 当需要发布当前的包的时候，首先你可以通过 `jk -f utils prepublish` 来准备发布内容，然后再运行 `jk -f utils publish` 来发布，最后通过 `jk -f utils postpublish` 来清理发布内容。

- 当然可能你会觉得上面的操作有点繁琐，你可以通过在对应包的 `package.json` 中添加 `scripts` 来简化操作。

```json
{
  ...
  "scripts": {
    "prepublish": "jb && jk",
    "postpublish": "jk"
  },
  ...
}
```

> 如果你需要在发布前对要发布的内容进行检查，你可以通过 `prepublish` 子指令来在你的 dist 产物目录（可配置）下会生成相关的 `package.json` 文件，你可以检阅相关生成的文件。

- 当配置好了上述的 hook 后，通过 `jk publish` 就可以一键完成构建发布动作了。

## CLI

```bash
jk/jiek [options] [command]
jb/jiek-build [options] [filters/entries]
```

### 自定义构建入口

你可以通过 `--entries` 来指定构建入口，这里的入口定义是基于 `package.json` 中的 `exports` 字段来进行的。

```bash
jb -e .
jb --entries .
jb --entries ./foo
jb --entries ./foo,./bar
```

当你的项目是一个非 `monorepo` 项目时，你可以直接通过 `jb [entries]` 来进行构建。

```bash
jb .
jb ./foo
jb ./foo,./bar
```

### 过滤器

你可以通过 `--filter` 来过滤需要构建的包，我们使用了和 pnpm 一样的过滤器规则，所以你可以在这里查阅 [pnpm 的过滤器规则](https://pnpm.io/filtering)

```bash
jb --filter @monorepo/*
jb --filter @monorepo/utils
jb -f utils
```

当你的项目是一个 `monorepo` 项目时，你可以直接通过 `jb [filters]` 来进行构建。

```bash
jb @monorepo/*
jb @monorepo/utils
jb utils
```

### 自定义构建工具

我们支持多种构建工具，你可以通过 `--type <type: esbuild | swc>` 来指定构建工具。

- 默认会使用 `esbuild`(`rollup-plugin-esbuild`)
- 如果你的依赖空间中存在 `swc`(`rollup-plugin-swc3`) 依赖，那么我们会自动切换到 `swc`
- 如果俩个都存在，默认会使用 `esbuild`

```bash
jb --type swc
```

> 如果使用类型的构建工具依赖没有安装，那我们会提示你安装对应的依赖。

### 环境变量

你可以通过 `--env.<name>=<value>` 来设置环境变量。

```bash
jb --env.NODE_ENV=production
jb --env.JIEK_BUILDER=swc --env.JIEK_OUT_DIR=lib
```

### 最小化

我们提供了多种方式来支持最小化的构建，默认会自动启用，同时我们默认会选择使用构建工具内置的最小化插件来进行最小化。

- 你可以通过 `--minType` 选择使用 `terser`(`rollup-plugin-terser`) 来进行最小化，如果你没有安装 `terser`，我们会提示你安装。
- 你可以通过 `--noMin` 来关闭生成最小化产物。
- 你可以通过 `--onlyMinify` 来只生成最小化产物，这样我们会直接替换原产物路径，而不是添加一个 `.min` 后缀再进行输出。

```bash
jb --minType terser
jb --onlyMinify
```

### 去除指定构建内容

你可以通过 `--noJs` 来关闭 `js` 的构建，通过 `--noDts` 来关闭 `dts` 的构建。

```bash
jb --noJs
jb --noDts
```

### 自定义产物目录

你可以通过 `--outdir` 来指定产物目录。

```bash
jb --outdir lib
```

### 监听模式

你可以通过 `--watch` 来开启监听模式。

```bash
jb --watch
```

### 外部模块

除了通过 `package.json` 中的 `dependencies`、`peerDependencies`、`optionalDependencies` 来自动标记外部模块外，你还可以通过 `--external` 来手动标记外部模块。

```bash
jb --external react
jb --external react,react-dom
```

### 关闭产物的自动清理

你可以通过 `--noClean` 来关闭产物的自动清理。

```bash
jb --noClean
```

### 自定义 tsconfig 路径

你可以通过 `--tsconfig` 来指定 `tsconfig` 的路径。

```bash
jb --tsconfig ./tsconfig.custom-build.json
```

同时你还可以通过 `--dtsconfig` 来指定 `dts` 插件使用的 `tsconfig` 的路径（当然我不建议你这么做）。

```bash
jb --dtsconfig ./tsconfig.custom-dts.json
```

### 发布命令

`publish` 命令允许你将当前包发布到 npm 注册表。它还会自动生成发布的 `package.json` 中的 `exports` 字段和其他字段。

```bash
jk publish [options]
```

#### 选项

- `-b, --bumper <bumper>`：版本号提升（默认：`patch`）
- `-no-b, --no-bumper`：不提升版本号
- `-o, --outdir <OUTDIR>`：指定输出目录（默认：`dist`）

#### 传递选项

如果你想将选项传递给 `pnpm publish` 命令，可以在 `--` 之后传递选项。

```bash
jk publish -- --access public --no-git-checks
```

## 为什么不使用 X？

在这里与 `jiek` 类似的工具有：[tsup](https://github.com/egoist/tsup)、[unbuild](https://github.com/unjs/unbuild)、[bunchee](https://github.com/huozhi/bunchee)、[pkgroll](https://github.com/privatenumber/pkgroll)、[tsdown](https://github.com/sxzz/tsdown)。但是他们都有着一些共同问题没有解决，比如说：

- `monorepo` 的支持存在一定的问题，在依赖工作空间其他的包时必须重新编译相关依赖
- 编写入口文件的规则过于繁琐，不够自然
- 无法处理 `tsconfig.json` 中的 `Project Reference` 相关问题
- 无法充分利用 `conditional` 的特性
- 无法自己选择需要的构建器，只能整个替换工具链

## 谁正在使用 Jiek？

- [nonzzz/vite-plugin-compression](https://github.com/nonzzz/vite-plugin-compression)
- [nonzzz/vite-bundle-analyzer](https://github.com/nonzzz/vite-bundle-analyzer)
- [nonzzz/squarified](https://github.com/nonzzz/squarified)
- [typp-js/typp](https://github.com/typp-js/typp)

## Q&A

- Q: postcss 插件无法正常启用
- A: postcss 插件依赖 `"rollup": "4.13.2"` 版本，如果你被默认安装上了更高版本的 rollup，你可以通过包管理器的 override 来锁定 jiek 的 rollup 的版本。
