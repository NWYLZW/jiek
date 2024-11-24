import { program } from 'commander'
import pkg from 'jiek/package.json'

program
  .name('jk/jiek')
  .version(pkg.version)
  .description(`${pkg.description} - Version ${pkg.version}`)
  .option('--root <root>', 'The root path of the project')
  .option('-c, --config-path <configPath>', 'Custom jiek config path')
