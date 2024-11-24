import { getWD } from '#~/utils/getWD.ts'

const { notWorkspace } = getWD()

export const IS_WORKSPACE = !notWorkspace
