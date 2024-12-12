import { foo } from './foo' with { external: 'true' };
export { foo } from './foo' with { external: 'true' };

const foofoo = foo + foo;

export { foofoo };
