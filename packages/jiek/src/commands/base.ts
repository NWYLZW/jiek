import { program } from 'commander'
import pkg from 'jiek/package.json'

import { filterDescription } from '#~/commands/descriptions.ts'
import { IS_WORKSPACE } from '#~/commands/meta.ts'
import { type } from '#~/utils/filterSupport.ts'

program
  .name('jk/jiek')
  .version(pkg.version)
  .description(`${pkg.description} - Version ${pkg.version}`)
  .option('-c, --config-path <configPath>', 'Custom jiek config path')
  .option('--env.<name>=<value>', 'Set the environment variable.')

if (type !== '' && IS_WORKSPACE) {
  program
    .option('-f, --filter <filter>', filterDescription)
}
