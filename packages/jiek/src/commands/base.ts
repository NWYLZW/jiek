import { program } from 'commander'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json')

program
  .version(pkg.version)
  .description(pkg.description)
  .option('--root <root>', 'root path')
  .option('-c, --config-path <configPath>', 'config path')