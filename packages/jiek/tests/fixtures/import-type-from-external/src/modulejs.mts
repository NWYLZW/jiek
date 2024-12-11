import type { Foo as RequireFoo } from 'foo' with { 'resolution-mode': 'require' }
import type { Foo as ImportFoo } from 'foo' with { 'resolution-mode': 'import' }

export { ImportFoo, RequireFoo }
