export function parseBoolean(v?: unknown) {
  if (v === undefined) return true
  return Boolean(v)
}
