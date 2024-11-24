# Jiek

| 繁體中文
| [简体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md)
| [日本語](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/ja/README.md)
| [Français](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/fr/README.md)
| [English](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/README.md)

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> 基於 `package.json` 元數據並適用於 `Monorepo` 的**輕便**工具庫編譯管理套件。

- [x] 自動推斷：基於 `package.json` 的相關字段自動推斷出構建規則，減少配置文件的編寫，更加輕便與符合標準
  - `exports`：根據入口文件推斷構建目標與類型
  - `imports`：定義路徑別名，並在構建的時候自動 bundle 進來
  - `type: module`：根據選項智能決定輸出文件後綴，不需要考慮 `cjs` 與 `esm` 的適配問題
  - `dependencies`、`peerDependencies`、`optionalDependencies`：自動將符合規則的依賴標記為 `external`
  - `devDependencies`：將標記為開發依賴的 bundle 進對應的最終產物之中
- [ ] 構建工具：支持多種構建工具，無需糾結於用 swc 還是 esbuild 又或者是 tsc
  - [x] `esbuild`
  - [x] `swc`
  - [ ] `typescript`
- [x] 工作空間友好：支持在 pnpm 下的工作空間開發範式
  - [ ] 支持更多的 PM
  - [ ] 更好的工作空間任務流
- [x] 類型定義文件：支持聚合生成類型定義文件
- [x] 監聽模式：適配 rollup 的監聽模式
- [x] 發佈適配：支持同構生成 `package.json` 等相關字段
  - [ ] 根據 `package.json` 中的路徑自動替換 README.md 中的相對路徑鏈接為對應的網絡鏈接
  - [ ] 根據倉庫、項目自動生成通用字段，如 `license`、`author`、`homepage`、`repository` 等
- [x] CommonJS：產物兼容正在使用 cjs 的用戶
- [ ] 插件化
  - [ ] Dotenv：支持 dotenv 配置文件
  - [ ] Replacer：支持替換文件內容
- [ ] 鉤子：prepublish、postpublish
  - [ ] 自動生成 changelog
  - [ ] 自動決定下一個版本號
    - [ ] `feat: xxx` -> `patch`
    - [ ] `feat!: xxx` -> `minor`
    - [ ] `feat!!: xxx` -> `major`

## 安裝

```bash
npm i -D jiek
# or
pnpm i -D jiek
# or
yarn add -D jiek
```

## 快速起步

通過一些簡單的方式能又快又輕鬆的生成需要的產物。

- 在 `package.json` 中添加入口文件，這裡需要設置為原文件路徑。

  你可以在 Node.js 文檔中查看更多對於 [exports](https://nodejs.org/api/packages.html#exports) 的相關內容。

```json
{
  ...
  "exports": "./src/index.ts",
  ...
}
```

- 假設你在工作空間下有一個包名字為 `@monorepo/utils` ，那麼你可以運行 `jk -f utils build` 來構建這個包。

- 當需要發佈當前的包的時候，首先你可以通過 `jk -f utils prepublish` 來準備發佈內容，然後再運行 `jk -f utils publish` 來發佈，最後通過 `jk -f utils postpublish` 來清理發佈內容。

- 當然可能你會覺得上面的操作有點繁瑣，你可以通過在對應包的 `package.json` 中添加 `scripts` 來簡化操作。

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

> 如果你需要在發佈前對要發佈的內容進行檢查，你可以通過 `prepublish` 子指令來在你的 dist 產物目錄（可配置）下會生成相關的 `package.json` 文件，你可以檢閱相關生成的文件。

- 當配置好了上述的 hook 後，通過 `jk publish` 就可以一鍵完成構建發佈動作了。

## CLI

```bash
jk/jiek [options] [command]
jb/jiek-build [options] [filters/entries]
```

### 自定義構建入口

你可以通過 `--entries` 來指定構建入口，這裡的入口定義是基於 `package.json` 中的 `exports` 字段來進行的。

```bash
jb -e .
jb --entries .
jb --entries ./foo
jb --entries ./foo,./bar
```

當你的項目是一個非 `monorepo` 項目時，你可以直接通過 `jb [entries]` 來進行構建。

```bash
jb .
jb ./foo
jb ./foo,./bar
```

### 過濾器

你可以通過 `--filter` 來過濾需要構建的包，我們使用了和 pnpm 一樣的過濾器規則，所以你可以在這裡查閱 [pnpm 的過濾器規則](https://pnpm.io/filtering)

```bash
jb --filter @monorepo/*
jb --filter @monorepo/utils
jb -f utils
```

當你的項目是一個 `monorepo` 項目時，你可以直接通過 `jb [filters]` 來進行構建。

```bash
jb @monorepo/*
jb @monorepo/utils
jb utils
```

### 自定義構建工具

我們支持多種構建工具，你可以通過 `--type <type: esbuild | swc>` 來指定構建工具。

- 默認會使用 `esbuild`(`rollup-plugin-esbuild`)
- 如果你的依賴空間中存在 `swc`(`rollup-plugin-swc3`) 依賴，那麼我們會自動切換到 `swc`
- 如果倆個都存在，默認會使用 `esbuild`

```bash
jb --type swc
```

> 如果使用類型的構建工具依賴沒有安裝，那我們會提示你安裝對應的依賴。

### 最小化

我們提供了多種方式來支持最小化的構建，默認會自動啟用，同時我們默認會選擇使用構建工具內置的最小化插件來進行最小化。

- 你可以通過 `--minType` 選擇使用 `terser`(`rollup-plugin-terser`) 來進行最小化，如果你沒有安裝 `terser`，我們會提示你安裝。
- 你可以通過 `--noMin` 來關閉生成最小化產物。
- 你可以通過 `--onlyMinify` 來只生成最小化產物，這樣我們會直接替換原產物路徑，而不是添加一個 `.min` 後綴再進行輸出。

```bash
jb --minType terser
jb --onlyMinify
```

### 去除指定構建內容

你可以通過 `--noJs` 來關閉 `js` 的構建，通過 `--noDts` 來關閉 `dts` 的構建。

```bash
jb --noJs
jb --noDts
```

### 自定義產物目錄

你可以通過 `--outdir` 來指定產物目錄。

```bash
jb --outdir lib
```

### 監聽模式

你可以通過 `--watch` 來開啟監聽模式。

```bash
jb --watch
```

### 外部模塊

除了通過 `package.json` 中的 `dependencies`、`peerDependencies`、`optionalDependencies` 來自動標記外部模塊外，你還可以通過 `--external` 來手動標記外部模塊。

```bash
jb --external react
jb --external react,react-dom
```

### 關閉產物的自動清理

你可以通過 `--noClean` 來關閉產物的自動清理。

```bash
jb --noClean
```

### 自定義 tsconfig 路徑

你可以通過 `--tsconfig` 來指定 `tsconfig` 的路徑。

```bash
jb --tsconfig ./tsconfig.custom-build.json
```

同時你還可以通過 `--dtsconfig` 來指定 `dts` 插件使用的 `tsconfig` 的路徑（當然我不建議你這麼做）。

```bash
jb --dtsconfig ./tsconfig.custom-dts.json
```

## 為什麼不使用 X？

在這裡與 `jiek` 類似的工具有：[tsup](https://github.com/egoist/tsup)、[unbuild](https://github.com/unjs/unbuild)、[bunchee](https://github.com/huozhi/bunchee)、[pkgroll](https://github.com/privatenumber/pkgroll)、[tsdown](https://github.com/sxzz/tsdown)。但是他們都有著一些共同問題沒有解決，比如說：

- `monorepo` 的支持存在一定的問題，在依賴工作空間其他的包時必須重新編譯相關依賴
- 編寫入口文件的規則過於繁瑣，不夠自然
- 無法處理 `tsconfig.json` 中的 `Project Reference` 相關問題
- 根據`conditions`
