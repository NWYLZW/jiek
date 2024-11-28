import './commands/publish'
import 'jiek/cli-only-build'

import process from 'node:process'

import { program } from 'commander'

program.parse(process.argv)
