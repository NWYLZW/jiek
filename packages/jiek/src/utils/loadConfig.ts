/* eslint-disable ts/no-require-imports */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { program } from 'commander'
import type { Config } from 'jiek'
import { load } from 'js-yaml'

import { getWD } from './getWD'
import { tsRegisterName } from './tsRegister'

let configName = 'jiek.config'

function getConfigPath(root: string, dir?: string) {
  const isSupportTsLoader = tsRegisterName != null
  function configWithExtIsExist(ext: string) {
    const filenames = [
      path.resolve(process.cwd(), `${configName}.${ext}`),
      path.resolve(process.cwd(), `.${configName}.${ext}`),
      path.resolve(root, `${configName}.${ext}`),
      path.resolve(root, `.${configName}.${ext}`)
    ]
    if (dir != null) {
      filenames.unshift(...[
        path.resolve(dir, `${configName}.${ext}`),
        path.resolve(dir, `.${configName}.${ext}`)
      ])
    }
    for (const filename of filenames) {
      if (
        fs.existsSync(filename)
        && fs.lstatSync(filename)
          .isFile()
      ) {
        return filename
      }
    }
  }
  configName = configWithExtIsExist('js') ?? configName
  configName = configWithExtIsExist('json') ?? configName
  configName = configWithExtIsExist('yaml') ?? configName
  if (isSupportTsLoader) {
    configName = configWithExtIsExist('ts') ?? configName
  }
  return path.resolve(root, configName)
}

interface LoadConfigOptions {
  dir?: string
  root?: string
}

export function loadConfig(options?: LoadConfigOptions): Config
export function loadConfig(dir?: string): Config
export function loadConfig(dirOrOptions?: string | LoadConfigOptions): Config {
  let dir: string | undefined
  let root: string
  if (typeof dirOrOptions === 'object') {
    dir = dirOrOptions.dir
    root = dirOrOptions.root ?? getWD().wd
  } else {
    dir = dirOrOptions
    root = getWD().wd
  }

  let configPath = program.getOptionValue('configPath') as string

  if (!configPath) {
    configPath = getConfigPath(root, dir)
  } else {
    if (!fs.existsSync(configPath)) {
      throw new Error(`config file not found: ${configPath}`)
    }
    if (!path.isAbsolute(configPath)) {
      configPath = path.resolve(root, configPath)
    }
  }
  const ext = path.extname(configPath)

  let module: Config | {
    default?: Config
  }
  switch (ext) {
    case '.js':
      module = require(configPath) as Config
      break
    case '.json':
      return require(configPath) as Config
    case '.yaml':
      return load(fs.readFileSync(configPath, 'utf-8')) as Config
    case '.ts':
      if (tsRegisterName != null) {
        require(tsRegisterName)
        module = require(configPath) as Config
        break
      }
      throw new Error(
        'ts config file is not supported without ts register, '
          + 'please install esbuild-register or set JIEK_TS_REGISTER env for custom ts register'
      )
    case '.config':
      module = {}
      break
    default:
      throw new Error(`unsupported config file type: ${ext}`)
  }
  if (module == null) {
    throw new Error('config file is empty')
  }
  if ('default' in module) {
    if (module.default == null) {
      throw new Error('config file is empty')
    }
    return module.default
  }
  return module as Config
}
