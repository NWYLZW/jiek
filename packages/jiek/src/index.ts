import type {} from './commands/base'
import type {} from './commands/build'
import type {} from './commands/publish'

export interface ConfigExperimental {
}

export interface Config {
  experimental?: ConfigExperimental
}

export const defineConfig = (config: Config) => config
