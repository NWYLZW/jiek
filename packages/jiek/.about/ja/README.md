# Jiek

| 日本語
| [简体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md)
| [繁体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hant/README.md)
| [Français](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/fr/README.md)
| [English](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/README.md)

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> `package.json` メタデータに基づき、`Monorepo` に適した**軽量**ツールキット。

- [x] 自動推論：`package.json` の関連フィールドに基づいてビルドルールを自動推論し、設定ファイルの記述を減らし、より軽量で標準に準拠
  - `exports`：エントリーファイルに基づいてビルドターゲットとタイプを推論
  - `imports`：パスエイリアスを定義し、ビルド時に自動的にバンドル
  - `type: module`：オプションに基づいて出力ファイルのサフィックスをインテリジェントに決定し、`cjs` と `esm` の互換性の問題を考慮する必要がない
  - `dependencies`、`peerDependencies`、`optionalDependencies`：ルールに従った依存関係を自動的に `external` としてマーク
  - `devDependencies`：開発依存関係としてマークされた依存関係を対応する最終成果物にバンドル
- [ ] ビルドツール：複数のビルドツールをサポートし、swc、esbuild、tsc の使用に悩む必要がない
  - [x] `esbuild`
  - [x] `swc`
  - [ ] `typescript`
- [x] ワークスペースフレンドリー：pnpm ワークスペースの開発パラダイムをサポート
  - [ ] より多くの PM をサポート
  - [ ] より良いワークスペースタスクフロー
- [x] 型定義ファイル：型定義ファイルの集約生成をサポート
- [x] ウォッチモード：rollup のウォッチモードに適応
- [x] パブリッシュ適応：`package.json` などの関連フィールドの同形生成をサポート
  - [ ] `package.json` のパスに基づいて README.md の相対パスリンクを対応するネットワークリンクに自動置換
  - [ ] リポジトリ、プロジェクトに基づいて `license`、`author`、`homepage`、`repository` などの共通フィールドを自動生成
- [x] CommonJS：cjs を使用しているユーザーに対応
- [ ] プラグインシステム
  - [ ] Dotenv：dotenv 設定ファイルをサポート
  - [ ] Replacer：ファイル内容の置換をサポート
- [ ] フック：prepublish、postpublish
  - [ ] changelog の自動生成
  - [ ] 次のバージョン番号の自動決定
    - [ ] `feat: xxx` -> `patch`
    - [ ] `feat!: xxx` -> `minor`
    - [ ] `feat!!: xxx` -> `major`

## インストール

```bash
npm i -D jiek
# または
pnpm i -D jiek
# または
yarn add -D jiek
```

## クイックスタート

いくつかの簡単な方法で必要な成果物を迅速かつ簡単に生成できます。

- `package.json` にエントリーファイルを追加し、ここでは元のファイルパスを設定する必要があります。

  Node.js ドキュメントで [exports](https://nodejs.org/api/packages.html#exports) についての詳細を確認できます。

```json
{
  ...
  "exports": "./src/index.ts",
  ...
}
```

- ワークスペースに `@monorepo/utils` という名前のパッケージがあると仮定すると、`jk -f utils build` を実行してこのパッケージをビルドできます。

- 現在のパッケージを公開する必要がある場合、まず `jk -f utils prepublish` を実行して公開内容を準備し、次に `jk -f utils publish` を実行して公開し、最後に `jk -f utils postpublish` を実行して公開内容をクリーンアップします。

- もちろん、上記の操作が少し面倒だと感じるかもしれませんが、対応するパッケージの `package.json` に `scripts` を追加することで操作を簡略化できます。

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

> 公開前に公開する内容を確認する必要がある場合、`prepublish` サブコマンドを使用して dist 成果物ディレクトリ（設定可能）に関連する `package.json` ファイルを生成し、生成されたファイルを確認できます。

- 上記のフックを設定した後、`jk publish` コマンドを使用してビルドと公開のアクションを一度に完了できます。

## CLI

```bash
jk/jiek [options] [command]
jb/jiek-build [options] [filters/entries]
```

### カスタムビルドエントリ

`--entries` を使用してビルドエントリを指定できます。ここでのエントリ定義は `package.json` の `exports` フィールドに基づいています。

```bash
jb -e .
jb --entries .
jb --entries ./foo
jb --entries ./foo,./bar
```

プロジェクトが非 `monorepo` プロジェクトの場合、`jb [entries]` を使用して直接ビルドできます。

```bash
jb .
jb ./foo
jb ./foo,./bar
```

### フィルター

`--filter` を使用してビルドするパッケージをフィルタリングできます。pnpm と同じフィルタールールを使用しているため、[pnpm のフィルタールール](https://pnpm.io/filtering) を確認できます。

```bash
jb --filter @monorepo/*
jb --filter @monorepo/utils
jb -f utils
```

プロジェクトが `monorepo` プロジェクトの場合、`jb [filters]` を使用して直接ビルドできます。

```bash
jb @monorepo/*
jb @monorepo/utils
jb utils
```

### カスタムビルドツール

複数のビルドツールをサポートしており、`--type <type: esbuild | swc>` を使用してビルドツールを指定できます。

- デフォルトでは `esbuild`（`rollup-plugin-esbuild`）が使用されます
- 依存関係スペースに `swc`（`rollup-plugin-swc3`）依存関係が存在する場合、自動的に `swc` に切り替わります
- 両方が存在する場合、デフォルトでは `esbuild` が使用されます

```bash
jb --type swc
```

> ビルドツール依存関係がインストールされていない場合、対応する依存関係をインストールするように促されます。

### 最小化

最小化されたビルドをサポートするための複数の方法を提供しており、デフォルトで自動的に有効になります。また、デフォルトではビルドツールの組み込み最小化プラグインを使用して最小化を行います。

- `--minType` を使用して `terser`（`rollup-plugin-terser`）を使用して最小化を行うことを選択できます。`terser` がインストールされていない場合、インストールするように促されます。
- `--noMin` を使用して最小化された成果物の生成を無効にできます。
- `--onlyMinify` を使用して最小化された成果物のみを生成できます。この場合、元の成果物パスを直接置き換え、`.min` サフィックスを追加して出力することはありません。

```bash
jb --minType terser
jb --onlyMinify
```

### 特定のビルド内容を除外

`--noJs` を使用して `js` のビルドを無効にし、`--noDts` を使用して `dts` のビルドを無効にできます。

```bash
jb --noJs
jb --noDts
```

### カスタム成果物ディレクトリ

`--outdir` を使用して成果物ディレクトリを指定できます。

```bash
jb --outdir lib
```

### ウォッチモード

`--watch` を使用してウォッチモードを有効にできます。

```bash
jb --watch
```

### 外部モジュール

`package.json` の `dependencies`、`peerDependencies`、`optionalDependencies` を通じて外部モジュールを自動的にマークするだけでなく、`--external` を使用して外部モジュールを手動でマークすることもできます。

```bash
jb --external react
jb --external react,react-dom
```

### 成果物の自動クリーンアップを無効にする

`--noClean` を使用して成果物の自動クリーンアップを無効にできます。

```bash
jb --noClean
```

### カスタム tsconfig パス

`--tsconfig` を使用して `tsconfig` のパスを指定できます。

```bash
jb --tsconfig ./tsconfig.custom-build.json
```

また、`--dtsconfig` を使用して `dts` プラグインが使用する `tsconfig` のパスを指定することもできます（ただし、これを行うことはお勧めしません）。

```bash
jb --dtsconfig ./tsconfig.custom-dts.json
```

### パブリッシュコマンド

`publish` コマンドを使用すると、現在のパッケージを npm レジストリに公開できます。また、公開された `package.json` の `exports` フィールドやその他のフィールドを自動的に生成します。

```bash
jk publish [options]
```

#### オプション

- `-b, --bumper <bumper>`：バージョンのバンプ（デフォルト：`patch`）
- `-no-b, --no-bumper`：バージョンのバンプなし
- `-o, --outdir <OUTDIR>`：出力ディレクトリを指定（デフォルト：`dist`）

#### パススルーオプション

`pnpm publish` コマンドにオプションを渡したい場合は、`--` の後にオプションを渡すことができます。

```bash
jk publish -- --access public --no-git-checks
```

## なぜ X を使用しないのか？

`jiek` に似たツールには、[tsup](https://github.com/egoist/tsup)、[unbuild](https://github.com/unjs/unbuild)、[bunchee](https://github.com/huozhi/bunchee)、[pkgroll](https://github.com/privatenumber/pkgroll)、[tsdown](https://github.com/sxzz/tsdown) があります。しかし、これらのツールには解決されていない共通の問題がいくつかあります。例えば：

- `monorepo` のサポートに一定の問題があり、ワークスペース内の他のパッケージに依存する場合、関連する依存関係を再コンパイルする必要がある
- エントリーファイルの記述ルールが煩雑で自然ではない
- `tsconfig.json` の `Project Reference` に関連する問題を処理できない
- `conditions` に基づいて
