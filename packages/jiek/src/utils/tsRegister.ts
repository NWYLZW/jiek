function packageIsExist(name: string) {
  try {
    require.resolve(name)
    return true
  } catch (e) {
    return false
  }
}

export let tsRegisterName: string | undefined
const registers = [
  process.env.JIEK_TS_REGISTER,
  'esbuild-register',
  '@swc-node/register',
  'ts-node/register'
].filter(Boolean) as string[]
for (const register of registers) {
  if (packageIsExist(register)) {
    tsRegisterName = register
    break
  }
}
