import { program } from 'commander'
import pkg from 'jiek/package.json'

program
  .version(pkg.version)
  .description(pkg.description)
  .option('--root <root>', 'root path')
  .option('-c, --config-path <configPath>', 'config path')
