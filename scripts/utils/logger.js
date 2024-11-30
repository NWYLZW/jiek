const process = require('node:process')

const {
  JIEK_LOG_LEVEL = 'info',
  JIEK_LOG_SILENT = 'false'
} = process.env

const silent = JIEK_LOG_SILENT === 'true'

/**
 * @typedef {{ [K in 'log' | 'info' | 'debug' | 'warn' | 'error']: (...args: any[]) => void }} Logger
 */
/**
 * @type {Logger}
 */
const logger = [
  'log',
  'info',
  'debug',
  'warn',
  'error'
].reduce((logger, method) => {
  logger[method] = (...args) => {
    if (silent) return
    if (
      ['info', 'debug', 'warn', 'error'].includes(method)
      && ['info', 'debug', 'warn', 'error'].indexOf(JIEK_LOG_LEVEL) < ['info', 'debug', 'warn', 'error'].indexOf(method)
    ) return
    console[method]('[jiek]', ...args)
  }
  return logger
}, {})

module.exports = logger
