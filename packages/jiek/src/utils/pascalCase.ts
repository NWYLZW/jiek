export const pascalCase = (str: string) =>
  str
    // eslint-disable-next-line ts/no-unsafe-member-access,ts/no-unsafe-return,ts/no-unsafe-call
    .replace(/[@|/-](\w)/g, (_, $1) => $1.toUpperCase())
    // eslint-disable-next-line ts/no-unsafe-member-access,ts/no-unsafe-return,ts/no-unsafe-call
    .replace(/(?:^|-)(\w)/g, (_, $1) => $1.toUpperCase())
