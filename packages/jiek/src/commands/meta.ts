import { getWD } from '#~/utils/getWD'

const { notWorkspace } = getWD()

export const IS_WORKSPACE = !notWorkspace
