export default {
  init: {
    named: {
      'packages/rollup-plugins/*': 'rollup-plugin-$basename',
      'packages/vite-plugins/*': 'vite-plugin-$basename'
    }
  }
}
