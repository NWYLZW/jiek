export default function(external: string) {
  // a/b      => AB
  // a-b      => AB
  // a@b      => AB
  // a@b/c    => ABC
  // node:a   => a
  // node:a_b => a_b
  if (external.startsWith('node:')) {
    return external.slice(5)
  }
  return external
    .replace(/[@|/-](\w)/g, (_, $1: string) => $1.toUpperCase())
}
