import { Main } from './analyzer'

declare global {
  // eslint-disable-next-line no-var,vars-on-top
  var CUSTOM_SIDE_BAR: boolean
  // eslint-disable-next-line no-var,vars-on-top
  var __REPLACE_INJECT__: string
}

function render() {
  CUSTOM_SIDE_BAR = true
  window.addEventListener('client:ready', () =>
    window.dispatchEvent(
      new CustomEvent('send:ui', {
        detail: { type: 'Main', Component: __REPLACE_INJECT__ }
      })
    ))
}

export const CLIENT_CUSTOM_RENDER_SCRIPT = [
  Main.toString(),
  render
    .toString()
    .replace('__REPLACE_INJECT__', Main.name),
  `(${render.name})()`
].join('\n')
