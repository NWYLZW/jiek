import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

import config from '@antfu/eslint-config'
import { mergeWith } from 'lodash-es'

import { defineExt, defineLintBase } from '@jiek/standard/eslint-helper'
import type { LintBaseOptions } from '@jiek/standard/eslint-helper'
import store from '@jiek/standard/eslint.config.store'

const require = createRequire(import.meta.url)

type UserConfig =
  & {
    tsconfig?: string
    base?: ReturnType<typeof defineLintBase>
    baseOptions?: LintBaseOptions
    baseOverride?: ReturnType<typeof defineLintBase>
    test?: ReturnType<typeof defineExt>
    testOverride?: ReturnType<typeof defineExt>
  }
  & {
    [K in string]?: ReturnType<typeof defineExt>
  }

const resolveUserConfigFrom = (path: string): UserConfig | undefined => {
  try {
    return require(path) as UserConfig
  } catch {}
}

const userConfigPaths = [
  'eslint.config.ts',
  'eslint.config.mts',
  'eslint.config.cts',
  'eslint.config.jk.ts',
  'eslint.config.jk.mts',
  'eslint.config.jk.cts',
  'eslint.config.jiek.ts',
  'eslint.config.jiek.mts',
  'eslint.config.jiek.cts'
]

const resolveUserConfig = (base: string) => {
  for (const path of userConfigPaths) {
    const resolved = resolveUserConfigFrom(`${base}/${path}`)
    if (resolved) return resolved
  }
}

export default async function(options?: {
  /**
   * @default true
   */
  styl?: boolean
  /**
   * @default store.JIEK_TS_CONFIG
   */
  tsconfig?: string
}) {
  let {
    JIEK_TS_CONFIG: tsconfigPath,
    JIEK_ESLINT_CONFIG_ROOT: root
  } = store

  if (root == null) {
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('throw error for get the stack')
    } catch (e) {
      const { stack } = e as Error
      for (const line of stack?.split('\n') ?? []) {
        if (line.trim().startsWith('at file://')) {
          const path = line.trim().split('file://')[1].split(':')[0]
          root = dirname(path)
        }
      }
    }
  }
  if (tsconfigPath == null && root != null) {
    const tsconfigPaths = [
      'tsconfig.json',
      'tsconfig.eslint.json',
      'tsconfig.jk.json',
      'tsconfig.jiek.json',
      'tsconfig.jk.eslint.json',
      'tsconfig.jiek.eslint.json'
    ]
    for (const path of tsconfigPaths) {
      const resolved = resolve(root, path)
      if (existsSync(resolved)) {
        tsconfigPath = resolved
        break
      }
    }
  }
  let base: UserConfig['base']
  let test: UserConfig['test']
  const exts: ReturnType<typeof defineExt>[] = []
  const tsESLintConfig = typeof root === 'string' ? resolveUserConfig(root) : undefined

  const getBase = () => {
    const { workspace } = tsESLintConfig?.baseOptions ?? {}
    const customGroupsForWorkspace = workspace != null
      ? (
        Array.isArray(workspace)
          ? workspace
          : [workspace]
      ).flatMap((workspace) => [
        `^${workspace}$`,
        `^${workspace}/.*$`,
        `^@${workspace}/.*$`
      ])
      : undefined
    return defineLintBase({
      stylistic: false,
      typescript: {
        tsconfigPath: options?.tsconfig ?? tsconfigPath,
        overrides: {
          'ts/no-namespace': 'off',
          'ts/no-empty-object-type': 'off',
          'ts/method-signature-style': 'off',
          'ts/no-use-before-define': 'off',
          'ts/ban-ts-comment': 'off',
          'ts/no-wrapper-object-types': 'off',
          'ts/no-unsafe-function-type': 'off',
          'ts/strict-boolean-expressions': 'off',

          'import/no-mutable-exports': 'off',
          'perfectionist/sort-imports': ['error', {
            internalPattern: [
              '^~/.*',
              '^#.*'
            ],
            sortSideEffects: true,
            groups: [
              ['side-effect', 'side-effect-style'],
              ['builtin-type', 'builtin'],
              ['external-type', 'external'],
              ['workspace-type', 'workspace'],
              ['internal-type', 'internal'],
              ['parent-type', 'sibling-type', 'index-type'],
              ['parent', 'sibling', 'index'],
              'object',
              'unknown'
            ],
            customGroups: {
              value: {
                workspace: customGroupsForWorkspace
              },
              type: {
                'workspace-type': customGroupsForWorkspace
              }
            }
          }],
          'perfectionist/sort-named-imports': 'off'
        }
      }
    })
  }
  const getTest = async () =>
    defineExt({
      files: [
        'packages/*/tests/**/*.{js,ts,tsx}',
        'vitest.config.ts',
        'eslint.config.mjs',
        'vitest.workspace.ts',
        'website/vite.config.ts',
        'scripts/**/*.{js,ts}'
      ],
      rules: {
        'no-console': 'off',
        'test/consistent-test-it': 'off'
      }
    })
  if (tsESLintConfig) {
    if (typeof tsESLintConfig.tsconfig === 'string') {
      tsconfigPath = tsESLintConfig.tsconfig
    }

    base = tsESLintConfig?.baseOverride
      ? tsESLintConfig.baseOverride
      : mergeWith(
        getBase(),
        tsESLintConfig?.base ?? {},
        (objValue, srcValue) => {
          if (Array.isArray(objValue)) {
            // eslint-disable-next-line ts/no-unsafe-return
            return objValue.concat(srcValue)
          }
        }
      )
    test = tsESLintConfig?.testOverride
      ? tsESLintConfig.testOverride
      : (async () =>
        mergeWith(
          await getTest(),
          await tsESLintConfig?.test ?? {},
          (objValue, srcValue) => {
            if (Array.isArray(objValue)) {
              // eslint-disable-next-line ts/no-unsafe-return
              return objValue.concat(srcValue)
            }
          }
        ))()
    for (const key in tsESLintConfig) {
      if (
        ![
          'tsconfig',
          'base',
          'baseOptions',
          'baseOverride',
          'test',
          'testOverride'
        ].includes(key)
      ) {
        exts.push(tsESLintConfig[key] as ReturnType<typeof defineExt>)
      }
    }
  } else {
    base = getBase()
    test = getTest()
  }
  return config(base, test, ...exts)
}
