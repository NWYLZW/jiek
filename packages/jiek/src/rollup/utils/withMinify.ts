import terser from '@rollup/plugin-terser'
import type { OutputOptions, OutputPlugin } from 'rollup'

export default function (output: OutputOptions & {
  entryFileNames?: string
  plugins?: OutputPlugin[]
}): OutputOptions[] {
  return [
    output,
    {
      ...output,
      entryFileNames: output.entryFileNames?.replace(/(\.c?js)$/, '.min$1'),
      plugins: [...(output.plugins ?? []), terser()]
    }
  ]
}
