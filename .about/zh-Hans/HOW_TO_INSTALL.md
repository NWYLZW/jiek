# 如何安装的依赖

由于 Monorepo 可能存在的复杂产物目标，并不是每一个开发者都需要去关心每个子项目的依赖，所以为了方便开发者能最快开始开发，这里提供了一种特殊的方式来安装依赖。

> 如果你只是关心本项目的核心功能，你只需要 `pnpm i` 即可，下面的内容也基本与你无关。

## 机制

在这里先简单介绍一下依赖安装对应的机制，这样能有助于更好地理解应该如何去工作。

当安装依赖时，本项目会根据几个情况来确定你当前的开发状态：

- 会逐层向上寻找
  - .jiek-mono-active 内容
  - `package.json` 中的 `.jiek.active` 字段
- 当找到则会使用该字段的值作为当前的开发状态
- 如果同时配置了 JIEK_MONO_ACTIVE 环境变量，则会覆盖上述的配置

## 操作

### 通常情况

在这里假设需要开发基干项目，这个时候的动作非常简单。

```shell
pnpm i
```

不需要做任何多余的动作便可以安装上基干项目的相关依赖，这是最简单的情况，这个时候我们会安装工作空间内的所有不带有特定模式的项目。

### 特定模式

假设现在需要开发某个特定模式，这个时候需要做一些额外的操作，但是也不复杂：

```shell
# unix-like
JIEK_MONO_ACTIVE=模式名称 pnpm i
# windows
set JIEK_MONO_ACTIVE=模式名称 && pnpm i
```

同时我们也支持多种模式的同时开发，只需要用逗号分隔即可：

```shell
# unix-like
JIEK_MONO_ACTIVE=模式名称1,模式名称2 pnpm i
# windows
set JIEK_MONO_ACTIVE=模式名称1,模式名称2 && pnpm i
```

除此之外，我们还会自动去寻找当你位于当前文件夹时，应该使用的模式，比如说你在 `packages/foo` 下执行 `pnpm i` 并且你的 `package.json` 中配置了 `.jiek.active` 字段，如：

```json
{
  ".jiek": {
    "active": "模式名称",
    // or
    "active": ["模式名称1", "模式名称2"]
  },
  // or
  ".jiek.active": "模式名称",
  // or
  ".jiek.active": ["模式名称1", "模式名称2"]
}
```

这个时候你不需要再手动设置 `JIEK_MONO_ACTIVE` 环境变量，我们会自动帮你设置（但是如果你设置了 `JIEK_MONO_ACTIVE` 环境变量，我们会优先使用环境变量的值）。

> 正如在上面所说的，还会向上寻找 `.jiek-mono-active` 文件，同级目录存在 `package.json` 时，这个文件的内容会被优先使用。
>
> 同时也会向上寻找 `package.json` 中的 `.jiek.active` 字段，比如说：
>
> 在 `packages/foo/src/xx` 下执行 `pnpm i`，会向上寻找到 `packages/foo/package.json` 中的 `.jiek.active` 字段。
