import type { Command } from 'commander'

import { CLIENT_CUSTOM_RENDER_SCRIPT } from '#~/commands/build/client/index'
import { parseBoolean } from '#~/commands/utils/optionParser'
import type { Module } from '#~/rollup/bundle-analyzer'
import type { createServer } from '#~/server'
import { checkDependency } from '#~/utils/checkDependency'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface AnalyzerBuildOptions {
  ana?: boolean
  /**
   * @default '.jk-analyses'
   */
  'ana.dir': string
  /**
   * @default 'server'
   */
  'ana.mode': string
  'ana.open'?: boolean
  /**
   * @default 'parsed'
   */
  'ana.size': string
}

export const registerAnalyzerCommandOptions = (command: Command) =>
  command
    .option('--ana', 'Enable the bundle analyzer.', parseBoolean)
    .option('--ana.dir <DIR>', 'The directory of the bundle analyzer.', '.jk-analyses')
    .option(
      '--ana.mode <MODE>',
      'The mode of the bundle analyzer, support "static", "json" and "server".',
      'server'
    )
    .option('--ana.open', 'Open the bundle analyzer in the browser.', parseBoolean)
    .option(
      '--ana.size <SIZE>',
      'The default size of the bundle analyzer, support "stat", "parsed" and "gzip".',
      'parsed'
    )

export const useAnalyzer = async (options: AnalyzerBuildOptions, server?: ReturnType<typeof createServer>) => {
  const modules: Module[] = []
  let bundleAnalyzerModule: typeof import('vite-bundle-analyzer') | undefined
  const analyzer = options.ana
    ? {
      dir: options['ana.dir'],
      mode: options['ana.mode'],
      open: options['ana.open'],
      size: options['ana.size']
    }
    : undefined
  if (
    options.ana
    && ![
      'stat',
      'parsed',
      'gzip'
    ].includes(analyzer?.size ?? '')
  ) {
    throw new Error('The value of `ana.size` must be "stat", "parsed" or "gzip"')
  }

  if (analyzer) {
    await checkDependency('vite-bundle-analyzer')
    bundleAnalyzerModule = await import('vite-bundle-analyzer')
  }

  const refreshAnalyzer = async (cwd: string, applyModules: typeof modules) => {
    if (!(analyzer && server && bundleAnalyzerModule)) return

    if (analyzer.mode === 'json') {
      const anaDir = path.resolve(cwd, analyzer.dir)
      if (!existsSync(anaDir)) {
        mkdirSync(anaDir, { recursive: true })
      }
      const gitIgnorePath = path.resolve(anaDir, '.gitignore')
      if (!existsSync(gitIgnorePath)) {
        writeFileSync(gitIgnorePath, '*\n!.gitignore\n')
      }
      const npmIgnorePath = path.resolve(anaDir, '.npmignore')
      if (!existsSync(npmIgnorePath)) {
        writeFileSync(npmIgnorePath, '*\n')
      }
      if (!statSync(anaDir).isDirectory()) {
        throw new Error(`The directory '${anaDir}' is not a directory.`)
      }
    }

    const { renderView, injectHTMLTag } = bundleAnalyzerModule
    applyModules.forEach(m => {
      const index = modules.findIndex(({ filename }) => filename === m.filename)
      if (index === -1) {
        modules.push(m)
      } else {
        modules[index] = m
      }
    })
    let html = await renderView(modules, {
      title: `Jiek Analyzer`,
      mode: analyzer.size as 'stat' | 'parsed' | 'gzip'
    })
    html = injectHTMLTag({
      html,
      injectTo: 'body',
      descriptors: [
        { kind: 'script', text: CLIENT_CUSTOM_RENDER_SCRIPT }
      ]
    })
    void server.renderTo('/ana', html)
  }

  return {
    modules,
    refreshAnalyzer,
    ANALYZER_ENV: {
      JIEK_ANALYZER: analyzer ? JSON.stringify(analyzer) : undefined
    }
  }
}
