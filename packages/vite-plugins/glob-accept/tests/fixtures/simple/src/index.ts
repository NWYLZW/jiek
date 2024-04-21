/// <reference types="vite/client" />

import.meta.glob('./*.ts', { eager: true })
if (import.meta.hot) {
  import.meta.hot.accept(['./*.ts'], console.log)
}
