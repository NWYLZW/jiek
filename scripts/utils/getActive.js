// @ts-check
const process = require('node:process')

const {
  JIEK_MONO_ACTIVE
} = process.env

/** @type {string[]} */
const active = JIEK_MONO_ACTIVE
  ?.split(',')
  ?.map(x => x.trim())
  ?? []

module.exports = active
