import './utils/filterSupport'
import './commands/base'
import './commands/build'

if (process.env.JIEK_IS_ONLY_BUILD === 'true') {
  // eslint-disable-next-line ts/no-floating-promises
  import('commander').then(({ program }) => {
    program.parse(process.argv)
  })
}
