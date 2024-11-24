# Jiek

| Français
| [简体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md)
| [繁体中文](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hant/README.md)
| [日本語](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/ja/README.md)
| [English](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/README.md)

[![npm version](https://img.shields.io/npm/v/jiek)](https://npmjs.com/package/jiek)
[![npm downloads](https://img.shields.io/npm/dm/jiek)](https://npm.chart.dev/jiek)

> Basé sur les métadonnées de `package.json` et adapté à `Monorepo`, un kit d'outils **léger** pour la compilation et la gestion des bibliothèques.

- [x] Inférence automatique : Inférer automatiquement les règles de construction en fonction des champs pertinents dans `package.json`, réduisant ainsi le besoin de fichiers de configuration, rendant le tout plus léger et conforme aux normes
  - `exports` : Inférer les cibles et les types de construction en fonction des fichiers d'entrée
  - `imports` : Définir des alias de chemin et les regrouper automatiquement lors de la construction
  - `type: module` : Décider intelligemment du suffixe du fichier de sortie en fonction des options, éliminant ainsi le besoin de considérer les problèmes de compatibilité `cjs` et `esm`
  - `dependencies`, `peerDependencies`, `optionalDependencies` : Marquer automatiquement les dépendances qui respectent les règles comme `external`
  - `devDependencies` : Regrouper les dépendances marquées comme dépendances de développement dans le produit final correspondant
- [ ] Outils de construction : Prendre en charge plusieurs outils de construction, pas besoin de se battre avec l'utilisation de swc, esbuild ou tsc
  - [x] `esbuild`
  - [x] `swc`
  - [ ] `typescript`
- [x] Compatible avec les espaces de travail : Prendre en charge les paradigmes de développement dans les espaces de travail pnpm
  - [ ] Prendre en charge plus de PM
  - [ ] Meilleur flux de tâches d'espace de travail
- [x] Fichiers de définition de type : Prendre en charge la génération agrégée de fichiers de définition de type
- [x] Mode de surveillance : S'adapter au mode de surveillance de rollup
- [x] Adaptation de la publication : Prendre en charge la génération isomorphe de `package.json` et d'autres champs connexes
  - [ ] Remplacer automatiquement les liens de chemin relatifs dans README.md par les liens réseau correspondants en fonction des chemins dans `package.json`
  - [ ] Générer automatiquement des champs communs tels que `license`, `author`, `homepage`, `repository`, etc. en fonction du dépôt et du projet
- [x] CommonJS : Compatible avec les utilisateurs qui utilisent encore cjs
- [ ] Système de plugins
  - [ ] Dotenv : Prendre en charge les fichiers de configuration dotenv
  - [ ] Replacer : Prendre en charge le remplacement du contenu des fichiers
- [ ] Hooks : prepublish, postpublish
  - [ ] Générer automatiquement le changelog
  - [ ] Décider automatiquement du prochain numéro de version
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

## Démarrage rapide

Générez les produits requis rapidement et facilement grâce à quelques méthodes simples.

- Ajoutez des fichiers d'entrée dans `package.json`, ici vous devez définir le chemin du fichier d'origine.

  Vous pouvez en savoir plus sur [exports](https://nodejs.org/api/packages.html#exports) dans la documentation de Node.js.

```json
{
  ...
  "exports": "./src/index.ts",
  ...
}
```

- Supposons que vous ayez un package nommé `@monorepo/utils` dans l'espace de travail, vous pouvez alors exécuter `jk -f utils build` pour construire ce package.

- Lorsque vous devez publier le package actuel, vous pouvez d'abord exécuter `jk -f utils prepublish` pour préparer le contenu de la publication, puis exécuter `jk -f utils publish` pour publier, et enfin exécuter `jk -f utils postpublish` pour nettoyer le contenu de la publication.

- Bien sûr, vous pouvez trouver les opérations ci-dessus un peu lourdes, vous pouvez simplifier les opérations en ajoutant `scripts` dans le `package.json` du package correspondant.

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

> Si vous avez besoin de vérifier le contenu à publier avant la publication, vous pouvez utiliser la sous-commande `prepublish` pour générer le fichier `package.json` correspondant dans votre répertoire de produits dist (configurable), et vous pouvez examiner les fichiers générés.

- Après avoir configuré les hooks ci-dessus, vous pouvez compléter les actions de construction et de publication avec une seule commande `jk publish`.

## CLI

```bash
jk/jiek [options] [command]
jb/jiek-build [options] [filters/entries]
```

### Entrée de construction personnalisée

Vous pouvez spécifier l'entrée de construction via `--entries`, la définition de l'entrée ici est basée sur le champ `exports` dans `package.json`.

```bash
jb -e .
jb --entries .
jb --entries ./foo
jb --entries ./foo,./bar
```

Lorsque votre projet n'est pas un projet `monorepo`, vous pouvez directement construire via `jb [entries]`.

```bash
jb .
jb ./foo
jb ./foo,./bar
```

### Filtres

Vous pouvez filtrer les packages à construire via `--filter`, nous utilisons les mêmes règles de filtre que pnpm, vous pouvez donc consulter les [règles de filtre pnpm](https://pnpm.io/filtering) ici.

```bash
jb --filter @monorepo/*
jb --filter @monorepo/utils
jb -f utils
```

Lorsque votre projet est un projet `monorepo`, vous pouvez directement construire via `jb [filters]`.

```bash
jb @monorepo/*
jb @monorepo/utils
jb utils
```

### Outils de construction personnalisés

Nous prenons en charge plusieurs outils de construction, vous pouvez spécifier l'outil de construction via `--type <type: esbuild | swc>`.

- Par défaut, `esbuild` (`rollup-plugin-esbuild`) sera utilisé
- Si la dépendance `swc` (`rollup-plugin-swc3`) existe dans votre espace de dépendance, nous passerons automatiquement à `swc`
- Si les deux existent, `esbuild` sera utilisé par défaut

```bash
jb --type swc
```

> Si la dépendance de l'outil de construction n'est pas installée, nous vous inviterons à installer la dépendance correspondante.

### Minification

Nous fournissons plusieurs façons de prendre en charge les constructions minifiées, qui sont activées par défaut, et nous utiliserons le plugin de minification intégré de l'outil de construction par défaut.

- Vous pouvez choisir d'utiliser `terser` (`rollup-plugin-terser`) pour la minification via `--minType`, si vous n'avez pas installé `terser`, nous vous inviterons à l'installer.
- Vous pouvez désactiver la génération de produits minifiés via `--noMin`.
- Vous pouvez générer uniquement des produits minifiés via `--onlyMinify`, dans ce cas, nous remplacerons directement le chemin du produit d'origine au lieu d'ajouter un suffixe `.min` avant de le sortir.

```bash
jb --minType terser
jb --onlyMinify
```

### Exclure un contenu de construction spécifique

Vous pouvez désactiver la construction de `js` via `--noJs`, et désactiver la construction de `dts` via `--noDts`.

```bash
jb --noJs
jb --noDts
```

### Répertoire de sortie personnalisé

Vous pouvez spécifier le répertoire de sortie via `--outdir`.

```bash
jb --outdir lib
```

### Mode de surveillance

Vous pouvez activer le mode de surveillance via `--watch`.

```bash
jb --watch
```

### Modules externes

En plus de marquer automatiquement les modules externes via `dependencies`, `peerDependencies`, `optionalDependencies` dans `package.json`, vous pouvez également marquer manuellement les modules externes via `--external`.

```bash
jb --external react
jb --external react,react-dom
```

### Désactiver le nettoyage automatique des produits

Vous pouvez désactiver le nettoyage automatique des produits via `--noClean`.

```bash
jb --noClean
```

### Chemin tsconfig personnalisé

Vous pouvez spécifier le chemin de `tsconfig` via `--tsconfig`.

```bash
jb --tsconfig ./tsconfig.custom-build.json
```

Vous pouvez également spécifier le chemin de `dtsconfig` utilisé par le plugin `dts` via `--dtsconfig` (bien que je ne recommande pas de le faire).

```bash
jb --dtsconfig ./tsconfig.custom-dts.json
```

### Commande de publication

La commande `publish` vous permet de publier le package actuel dans le registre npm. Elle génère également automatiquement le champ `exports` et d'autres champs dans le `package.json` publié.

```bash
jk publish [options]
```

#### Options

- `-b, --bumper <bumper>` : Augmenter la version (par défaut : `patch`)
- `-no-b, --no-bumper` : Ne pas augmenter la version
- `-o, --outdir <OUTDIR>` : Spécifier le répertoire de sortie (par défaut : `dist`)

#### Options de passage

Si vous souhaitez passer des options à la commande `pnpm publish`, vous pouvez les passer après `--`.

```bash
jk publish -- --access public --no-git-checks
```

## Pourquoi ne pas utiliser X ?

Des outils similaires à `jiek` incluent : [tsup](https://github.com/egoist/tsup), [unbuild](https://github.com/unjs/unbuild), [bunchee](https://github.com/huozhi/bunchee), [pkgroll](https://github.com/privatenumber/pkgroll), [tsdown](https://github.com/sxzz/tsdown). Cependant, ils ont tous des problèmes communs qui n'ont pas été résolus, tels que :

- Il y a certains problèmes avec la prise en charge de `monorepo`, et les dépendances à d'autres packages dans l'espace de travail doivent être recompilées
- Les règles pour écrire des fichiers d'entrée sont trop lourdes et pas assez naturelles
- Incapable de gérer les problèmes liés à `Project Reference` dans `tsconfig.json`
- Incapable de tirer pleinement parti des fonctionnalités `conditional`
- Incapable de choisir le constructeur requis, ne peut remplacer toute la chaîne d'outils

## Qui utilise Jiek ?

- [nonzzz/vite-plugin-compression](https://github.com/nonzzz/vite-plugin-compression)
- [nonzzz/vite-bundle-analyzer](https://github.com/nonzzz/vite-bundle-analyzer)
- [nonzzz/squarified](https://github.com/nonzzz/squarified)
- [typp-js/typp](https://github.com/typp-js/typp)

## À propos de ce README

Ce README est généré par [copilot workspace](https://githubnext.com/projects/copilot-workspace) et provient du fichier [zh-Hans/README.md](https://github.com/NWYLZW/jiek/blob/master/packages/jiek/.about/zh-Hans/README.md).
