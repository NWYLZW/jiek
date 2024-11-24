# Jiek

| English
| [简体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md)
| [繁体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hant/README.md)
| [日本語](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/ja/README.md)
| [Français](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/fr/README.md)

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> A lightweight toolkit for compiling and managing libraries based on `package.json` metadata and suitable for `Monorepo`.

- [x] Automatic inference: Automatically infer build rules based on relevant fields in `package.json`, reducing the need for configuration files, making it more lightweight and standard-compliant
  - `exports`: Infer build targets and types based on entry files
  - `imports`: Define path aliases and automatically bundle them during the build
  - `type: module`: Intelligently decide the output file suffix based on options, eliminating the need to consider `cjs` and `esm` compatibility issues
  - `dependencies`, `peerDependencies`, `optionalDependencies`: Automatically mark dependencies that meet the rules as `external`
  - `devDependencies`: Bundle dependencies marked as development dependencies into the corresponding final product
- [ ] Build tools: Support multiple build tools, no need to struggle with using swc, esbuild, or tsc
  - [x] `esbuild`
  - [x] `swc`
  - [ ] `typescript`
- [x] Workspace-friendly: Support development paradigms in pnpm workspaces
  - [ ] Support more PMs
  - [ ] Better workspace task flow
- [x] Type definition files: Support aggregated generation of type definition files
- [x] Watch mode: Adapt to rollup's watch mode
- [x] Publish adaptation: Support isomorphic generation of `package.json` and other related fields
  - [ ] Automatically replace relative path links in README.md with corresponding network links based on paths in `package.json`
  - [ ] Automatically generate common fields such as `license`, `author`, `homepage`, `repository`, etc. based on the repository and project
- [x] CommonJS: Compatible with users who are still using cjs
- [ ] Plugin system
  - [ ] Dotenv: Support dotenv configuration files
  - [ ] Replacer: Support replacing file content
- [ ] Hooks: prepublish, postpublish
  - [ ] Automatically generate changelog
  - [ ] Automatically decide the next version number
    - [ ] `feat: xxx` -> `patch`
    - [ ] `feat!: xxx` -> `minor`
    - [ ] `feat!!: xxx` -> `major`

## Installation

```bash
npm i -D jiek
# or
pnpm i -D jiek
# or
yarn add -D jiek
```

## Quick Start

Generate the required products quickly and easily through some simple methods.

- Add entry files in `package.json`, here you need to set the original file path.

  You can see more about [exports](https://nodejs.org/api/packages.html#exports) in the Node.js documentation.

```json
{
  ...
  "exports": "./src/index.ts",
  ...
}
```

- Suppose you have a package named `@monorepo/utils` in the workspace, then you can run `jk -f utils build` to build this package.

- When you need to publish the current package, you can first run `jk -f utils prepublish` to prepare the publishing content, then run `jk -f utils publish` to publish, and finally run `jk -f utils postpublish` to clean up the publishing content.

- Of course, you may find the above operations a bit cumbersome, you can simplify the operations by adding `scripts` in the corresponding package's `package.json`.

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

> If you need to check the content to be published before publishing, you can use the `prepublish` subcommand to generate the relevant `package.json` file in your dist product directory (configurable), and you can review the generated files.

- After configuring the above hooks, you can complete the build and publish actions with one command `jk publish`.

## CLI

```bash
jk/jiek [options] [command]
jb/jiek-build [options] [filters/entries]
```

### Custom Build Entry

You can specify the build entry through `--entries`, the entry definition here is based on the `exports` field in `package.json`.

```bash
jb -e .
jb --entries .
jb --entries ./foo
jb --entries ./foo,./bar
```

When your project is a non-`monorepo` project, you can directly build through `jb [entries]`.

```bash
jb .
jb ./foo
jb ./foo,./bar
```

### Filters

You can filter the packages to be built through `--filter`, we use the same filter rules as pnpm, so you can check the [pnpm filter rules](https://pnpm.io/filtering) here.

```bash
jb --filter @monorepo/*
jb --filter @monorepo/utils
jb -f utils
```

When your project is a `monorepo` project, you can directly build through `jb [filters]`.

```bash
jb @monorepo/*
jb @monorepo/utils
jb utils
```

### Custom Build Tools

We support multiple build tools, you can specify the build tool through `--type <type: esbuild | swc>`.

- By default, `esbuild` (`rollup-plugin-esbuild`) will be used
- If the `swc` (`rollup-plugin-swc3`) dependency exists in your dependency space, we will automatically switch to `swc`
- If both exist, `esbuild` will be used by default

```bash
jb --type swc
```

> If the build tool dependency is not installed, we will prompt you to install the corresponding dependency.

### Minification

We provide multiple ways to support minified builds, which are enabled by default, and we will use the build tool's built-in minification plugin for minification by default.

- You can choose to use `terser` (`rollup-plugin-terser`) for minification through `--minType`, if you have not installed `terser`, we will prompt you to install it.
- You can disable the generation of minified products through `--noMin`.
- You can generate only minified products through `--onlyMinify`, in this case, we will directly replace the original product path instead of adding a `.min` suffix before outputting.

```bash
jb --minType terser
jb --onlyMinify
```

### Exclude Specific Build Content

You can disable the build of `js` through `--noJs`, and disable the build of `dts` through `--noDts`.

```bash
jb --noJs
jb --noDts
```

### Custom Output Directory

You can specify the output directory through `--outdir`.

```bash
jb --outdir lib
```

### Watch Mode

You can enable watch mode through `--watch`.

```bash
jb --watch
```

### External Modules

In addition to automatically marking external modules through `dependencies`, `peerDependencies`, `optionalDependencies` in `package.json`, you can also manually mark external modules through `--external`.

```bash
jb --external react
jb --external react,react-dom
```

### Disable Automatic Cleanup of Products

You can disable the automatic cleanup of products through `--noClean`.

```bash
jb --noClean
```

### Custom tsconfig Path

You can specify the path of `tsconfig` through `--tsconfig`.

```bash
jb --tsconfig ./tsconfig.custom-build.json
```

You can also specify the path of `dtsconfig` used by the `dts` plugin through `--dtsconfig` (although I don't recommend doing this).

```bash
jb --dtsconfig ./tsconfig.custom-dts.json
```

## Why not use X?

Similar tools to `jiek` include: [tsup](https://github.com/egoist/tsup), [unbuild](https://github.com/unjs/unbuild), [bunchee](https://github.com/huozhi/bunchee), [pkgroll](https://github.com/privatenumber/pkgroll), [tsdown](https://github.com/sxzz/tsdown). However, they all have some common issues that have not been resolved, such as:

- There are certain issues with `monorepo` support, and dependencies on other packages in the workspace must be recompiled
- The rules for writing entry files are too cumbersome and not natural enough
- Unable to handle issues related to `Project Reference` in `tsconfig.json`
- According to `conditions`

## About this README

This README is generated by [copilot workspace](https://githubnext.com/projects/copilot-workspace) and originates from the [zh-Hans/README.md](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md) file.
