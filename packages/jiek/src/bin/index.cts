import '../commands/publish'
import './build' with { external: 'true' }

import parseArgv from '#~/bin/parseArgv.ts'

parseArgv()
