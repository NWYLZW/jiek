import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'
import detectIndent from 'detect-indent'
import inquirer from 'inquirer'
import type { Config, InitNamed } from 'jiek'
import { applyEdits, modify } from 'jsonc-parser'
import { isMatch } from 'micromatch'

import { getWD } from '../utils/getWD'
import { loadConfig } from '../utils/loadConfig'

declare module 'jiek' {
  export type InitNamedFunction = (
    argument: string,
    paths: {
      full: string
      relative: string
      basename?: string
    }
  ) => [name?: string, path?: string]
  export type InitNamed =
    | InitNamedFunction
    | {
      [key: string]: string | InitNamedFunction
    }
  export interface Config {
    init?: {
      /**
       * the package.json template file path or file content
       *
       * if it can be parsed as json, it will be parsed
       * if it is a relative file path, it will be resolved to an absolute path based on the current working directory
       * if it is an absolute file path, it will be used directly
       * @default '.jiek.template.package.json'
       */
      template?: string
      /**
       * the readme content
       *
       * $name will be replaced with the package name
       * $license will be replaced with the license
       */
      readme?:
        | string
        | ((ctx: {
          dir: string
          packageJson: Record<string, any>
        }) => string)
      /**
       * the readme template file path
       * @default '.jiek.template.readme.md'
       */
      readmeTemplate?: string
      bug?: {
        /**
         * @default 'bug_report.yml'
         */
        template?: string
        /**
         * @default ['bug']
         */
        labels?:
          | string[]
          | ((ctx: {
            name: string
            dir: string
          }) => string[])
      }
      named?: InitNamed
    }
  }
}

const PACKAGE_JSON_TEMPLATE = `{
  "name": "",
  "version": "0.0.1",
  "description": "",
  "license": "",
  "author": "",
  "files": ["dist"],
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
  },
  "homepage": "",
  "repository": "",
  "bugs": ""
}`.trimStart()
const README_TEMPLATE = `# $name

## Installation

\`\`\`bash
npm install $name
# or
pnpm install $name
# or
yarn add $name
\`\`\`

## Usage


## License

$license
`.trimStart()

function getTemplateStr(wd: string, template: string | undefined) {
  let templateString = template ?? PACKAGE_JSON_TEMPLATE
  let isTemplateFile = false
  try {
    if (template) JSON.parse(template)
  } catch (e) {
    isTemplateFile = true
  }
  if (isTemplateFile) {
    const templatePath = path.resolve(wd, template!)
    templateString = fs.readFileSync(templatePath, 'utf-8')
  }
  return templateString
}
const wdCache = new Map<string, Record<string, any>>()
function getWDPackageJSONFiled(wd: string, field: string) {
  if (wdCache.has(wd)) {
    return wdCache.get(wd)![field]
  }
  const packageJSONPath = path.resolve(wd, 'package.json')
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'))
  wdCache.set(wd, packageJSON)
  return packageJSON[field]
}
async function getName(
  named: InitNamed | undefined,
  name: string,
  {
    wd,
    cwd,
    workspaceName
  }: {
    wd: string
    cwd: string
    workspaceName: string
  }
): Promise<[name?: string, path?: string]> {
  const relativePath = cwd.replace(`${wd}/`, '')
  let basename = path.basename(cwd)

  if (typeof named === 'function') {
    return named(name, {
      full: wd,
      relative: cwd
    })
  }

  let isParentMatched = false
  let matchedKey: string | undefined
  let matchedRule: NonNullable<typeof named>[string] | undefined
  if (typeof named === 'object') {
    const isWD = cwd === wd
    if (isWD) {
      const { rule } = await inquirer.prompt<{ rule: string }>({
        type: 'list',
        name: 'rule',
        message: 'choose a rule',
        default: 'default',
        choices: ['default'].concat(Object.keys(named))
      })
      if (rule !== 'default') {
        matchedKey = rule
        matchedRule = named[rule]
      }
    } else {
      for (const [key, value] of Object.entries(named)) {
        if (isMatch(relativePath, key)) {
          matchedKey = key
          matchedRule = value
          break
        }
        if (isMatch(`${relativePath}/jiek_ignore_dont_use_same_file_name`, key)) {
          isParentMatched = true
          matchedKey = key
          matchedRule = value
          break
        }
      }
    }
  }
  if (!matchedRule) {
    matchedKey = 'packages/*'
    matchedRule = `@${workspaceName}/$basename`
  }
  if (!matchedRule) {
    throw new Error('no matched rule')
  }
  if (!name && isParentMatched) {
    basename = await inquirer.prompt<{ name: string }>({
      type: 'input',
      name: 'name',
      message: `the matched rule is \`${String(matchedRule)}\`, please input the basename\n`
    }).then(({ name }) => name)
  }

  if (typeof matchedRule === 'function') {
    return matchedRule(name, {
      full: wd,
      relative: cwd,
      basename: basename
    })
  }
  if (typeof matchedRule === 'string') {
    const dirName = name ?? basename
    return [
      matchedRule.replace(/\$basename/g, dirName),
      matchedKey?.replace(/\/\*$/g, `/${dirName}`)
    ]
  }
  throw new Error('no matched rule')
}

program
  .command('init [name]')
  .option('-t, --template <template>', 'the package.json template file path or file content')
  .action(async () => {
    const [, name] = program.args
    const cwd = process.cwd()
    const { init = {} }: Config = loadConfig() ?? {}
    const { wd } = getWD()
    const workspaceName = path.basename(wd)

    const {
      named,
      template,
      bug = {},
      readme: _readme = README_TEMPLATE,
      readmeTemplate
    } = init
    const resolvedBug = {
      template: 'bug_report.yml',
      labels: ['bug'],
      ...bug
    }
    let readme = _readme
    if (readmeTemplate) {
      const readmeTemplatePath = path.resolve(wd, readmeTemplate)
      readme = fs.readFileSync(readmeTemplatePath, 'utf-8')
    }

    const templateString = getTemplateStr(wd, template)
    // TODO detectIndent by editorconfig
    const { indent = '    ' } = detectIndent(templateString)
    const formattingOptions = {
      tabSize: indent.length,
      insertSpaces: true
    }
    const passFields = [
      'license',
      'author'
    ]
    let newJSONString = templateString
    for (const field of passFields) {
      newJSONString = applyEdits(
        newJSONString,
        modify(
          newJSONString,
          [field],
          getWDPackageJSONFiled(wd, field),
          { formattingOptions }
        )
      )
    }
    let [pkgName, pkgDir] = await getName(named, name, {
      wd,
      cwd,
      workspaceName
    })
    if (!pkgDir) {
      const { dir } = await inquirer.prompt<{ dir: string }>({
        type: 'input',
        name: 'dir',
        message: 'package directory',
        default: name
      })
      pkgDir = dir
    }
    if (!pkgName) {
      const { name: inputName } = await inquirer.prompt<{
        name: string
      }>({
        type: 'input',
        name: 'name',
        message: 'package name',
        default: name
      })
      pkgName = inputName
    }
    newJSONString = applyEdits(newJSONString, modify(newJSONString, ['name'], pkgName, { formattingOptions }))

    let pkgRepo = getWDPackageJSONFiled(wd, 'repository')
    if (typeof pkgRepo === 'string') {
      pkgRepo = {
        type: 'git',
        url: pkgRepo,
        directory: pkgDir
      }
    }
    newJSONString = applyEdits(
      newJSONString,
      modify(
        newJSONString,
        ['repository'],
        pkgRepo,
        { formattingOptions }
      )
    )
    const homepage = `${pkgRepo?.url}/blob/master/${pkgDir}/README.md`
    newJSONString = applyEdits(
      newJSONString,
      modify(
        newJSONString,
        ['homepage'],
        homepage,
        { formattingOptions }
      )
    )
    let labels = resolvedBug.labels
    if (typeof labels === 'function') {
      labels = labels({
        name: pkgName,
        dir: pkgDir
      })
    }
    labels.push(`scope:${pkgName}`)
    const bugs = `${pkgRepo?.url}/issues/new?template=${resolvedBug.template}&labels=${labels.join(',')}`
    newJSONString = applyEdits(
      newJSONString,
      modify(
        newJSONString,
        ['bugs'],
        bugs,
        { formattingOptions }
      )
    )

    function pkgDirTo(to: string) {
      if (!pkgDir) throw new Error('pkgDir is not defined')

      return path.resolve(pkgDir, to)
    }
    if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir)
    const pkgJSONFilePath = pkgDirTo('package.json')
    if (fs.existsSync(pkgJSONFilePath)) {
      throw new Error('package.json already exists')
    }
    fs.writeFileSync(pkgJSONFilePath, newJSONString)
    console.log(newJSONString, 'written to', pkgJSONFilePath)

    const license = getWDPackageJSONFiled(wd, 'license')
    const readmeFilePath = pkgDirTo('README.md')
    if (typeof readme === 'function') {
      readme = readme({
        dir: pkgDir,
        packageJson: JSON.parse(newJSONString)
      })
    }
    const readmeContent = readme
      .replace(/\$name/g, pkgName)
      .replace(/\$license/g, license)
    fs.writeFileSync(readmeFilePath, readmeContent)
  })
