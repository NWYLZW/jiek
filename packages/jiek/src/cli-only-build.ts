import './utils/filterSupport'
import './commands/base'
import './commands/build'

if (process.env.JIEK_IS_ONLY_BUILD === 'true') {
  import('commander').then(({ program }) => {
    program.parse(process.argv)
  })
}
