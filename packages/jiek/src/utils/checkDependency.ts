import process from 'node:process'

import { confirm } from '@inquirer/prompts'
import { execaCommand } from 'execa'

import { getWD } from '#~/utils/getWD.ts'

export async function checkDependency(dependency: string) {
  try {
    require.resolve(dependency)
  } catch {
    console.error(`The package '${dependency}' is not installed, please install it first.`)
    const { notWorkspace } = getWD()
    const command = `pnpm install -${notWorkspace ? '' : 'w'}D ${dependency}`
    if (await confirm({ message: 'Do you want to install it now?' })) {
      await execaCommand(command)
    } else {
      console.warn(`You can run the command '${command}' to install it manually.`)
      process.exit(1)
    }
  }
}
