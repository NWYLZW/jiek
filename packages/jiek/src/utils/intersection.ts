export const intersection = <T>(a: Iterable<T>, b: Set<T>) => new Set([...a].filter(i => b.has(i)))
