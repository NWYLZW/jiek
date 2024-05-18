import './utils/filterSupport'
import './commands/build'
import './commands/init'
import './commands/publish'

import { program } from 'commander'

program.parse(process.argv)
