let resolve: () => void

export let actionFuture: Promise<void>

export function actionDone() {
  resolve()
}

export function actionRestore() {
  actionFuture = new Promise<void>(r => resolve = r)
}
