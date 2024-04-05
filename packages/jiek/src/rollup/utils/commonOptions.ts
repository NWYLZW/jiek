import type { OutputOptions } from 'rollup'

const defineOutput = <O extends OutputOptions>(output: O) => output

export const commonOutputOptions = defineOutput({
  dir: 'dist',
  exports: 'named',
  interop: 'auto',
  sourcemap: true
})
