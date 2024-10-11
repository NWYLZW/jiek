import fs from 'node:fs'
import path from 'node:path'

import { program } from 'commander'
import type { Config } from 'jiek'
import { load } from 'js-yaml'

import { getWD } from './getWD'
import { tsRegisterName } from './tsRegister'

let configName = 'jiek.config'

function getConfigPath(root: string, dir?: string) {
  const isSupportTsLoader = !!tsRegisterName
  function configWithExtIsExist(ext: string) {
    const filenames = [
      path.resolve(process.cwd(), `${configName}.${ext}`),
      path.resolve(process.cwd(), `.${configName}.${ext}`),
      path.resolve(root, `${configName}.${ext}`),
      path.resolve(root, `.${configName}.${ext}`)
    ]
    if (dir) {
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
    return
  }
  configName = configWithExtIsExist('js') ?? configName
  configName = configWithExtIsExist('json') ?? configName
  configName = configWithExtIsExist('yaml') ?? configName
  if (isSupportTsLoader) {
    configName = configWithExtIsExist('ts') ?? configName
  }
  return path.resolve(root, configName)
}

export function loadConfig(dir?: string): Config {
  const { wd: root } = getWD()

  let configPath = program.getOptionValue('configPath')

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

  let module: any
  switch (ext) {
    case '.js':
      module = require(configPath)
      break
    case '.json':
      return require(configPath)
    case '.yaml':
      return load(fs.readFileSync(configPath, 'utf-8')) as Config
    case '.ts':
      if (tsRegisterName) {
        require(tsRegisterName)
        module = require(configPath)
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
  if (!module) throw new Error('config file is empty')

  return module.default ?? module
}
