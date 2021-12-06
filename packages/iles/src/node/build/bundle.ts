/* eslint-disable no-restricted-syntax */
import { promises as fs } from 'fs'
import type { RollupOutput } from 'rollup'
import type { Plugin } from 'vite'
import glob from 'fast-glob'
import { extname, relative, dirname, resolve } from 'pathe'
import { build, mergeConfig as mergeViteConfig, UserConfig as ViteUserConfig } from 'vite'
import { APP_PATH } from '../alias'
import { AppConfig } from '../shared'
import IslandsPlugins from '../plugin/plugin'
import { rm } from './utils'

type Entrypoints = Record<string, string>

// Internal: Bundles the Islands app for both client and server.
//
// Multi-entry build: every page is considered an entry chunk.
export async function bundle (config: AppConfig) {
  const [clientResult, serverResult,] = await Promise.all([
    bundleClient(config),
    bundleSSR(config),
  ])

  return { clientResult, serverResult }
}

async function bundleClient (config: AppConfig) {
  const entrypoints = glob.sync(resolve(config.pagesDir, './**/*'), { cwd: config.root })

  return await bundleWithVite(config, entrypoints, { ssr: false })
}

async function bundleSSR (config: AppConfig) {
  return await bundleWithVite(config, { app: APP_PATH }, { ssr: true })
}

// Internal: Creates a client and server bundle.
// NOTE: The client bundle is used only to obtain styles, JS is discarded.
async function bundleWithVite (config: AppConfig, entrypoints: string[] | Entrypoints, options: { ssr: boolean }) {
  const { ssr } = options

  return await build(mergeViteConfig(config.vite, {
    logLevel: 'warn',
    ssr: {
      external: ['vue', '@vue/server-renderer'],
      noExternal: ['iles'],
    },
    plugins: [
      IslandsPlugins(config),
      !ssr && [
        appImportsPlugin(config),
        moveHtmlPagesPlugin(config, entrypoints as string[]),
      ],
    ],
    build: {
      ssr,
      cssCodeSplit: !ssr,
      manifest: !ssr,
      minify: ssr ? false : 'esbuild',
      emptyOutDir: ssr,
      outDir: ssr ? config.tempDir : config.outDir,
      rollupOptions: {
        input: entrypoints,
        preserveEntrySignatures: 'allow-extension',
        treeshake: !ssr,
      },
    },
  } as ViteUserConfig)) as RollupOutput
}

// Internal: Because the client build does not import the iles app, this plugin
// injects imports to the app and site, ensuring any styles imported are kept.
function appImportsPlugin (config: AppConfig): Plugin {
  const { pagesDir } = config
  return {
    name: 'iles:client-app-imports',
    transform (code, id) {
      if (!id.includes(pagesDir)) return

      const ext = extname(id).slice(1) || ''
      if (!config.pages.extensions!.some(extension => extension === ext)) return

      return `import '@islands/user-app';import '@islands/user-site';${code}`
    },
    // Internal: user-app.css, user-site.css => site.css
    generateBundle (_, bundle) {
      const outDir = resolve(config.root, config.outDir)
      for (const name in bundle) {
        const chunk = bundle[name]

        if (chunk.type === 'chunk') {
          const { code, ...other } = chunk
          fs.mkdir(resolve(outDir, 'chunks'), { recursive: true })
            .then(() => fs.writeFile(resolve(outDir, 'chunks', `${chunk.name}.json`), JSON.stringify(other, null, 2), 'utf-8'))
        }

        if (chunk.type === 'asset' && chunk.fileName.includes('/user-'))
          chunk.fileName = chunk.fileName.replace(/user-(?:app|site)/, 'site')
      }
    },
  }
}

// Internal: Moves any HTML entrypoints to the correct location in the output dir.
function moveHtmlPagesPlugin (config: AppConfig, entrypoints: string[]): Plugin {
  const htmlFiles = new Set(
    entrypoints.filter(file => file.endsWith('.html'))
      .map(file => relative(config.root, file)))

  return {
    name: 'iles:html-pages',
    async writeBundle (options, bundle) {
      const outDir = resolve(config.root, config.outDir)
      const movePromises = []
      for (const name in bundle) {
        if (htmlFiles.has(name)) {
          const dest = resolve(outDir, relative(config.pagesDir, resolve(config.root, name)))
          movePromises.push(fs.mkdir(dirname(dest), { recursive: true })
            .then(() => fs.rename(resolve(outDir, name), dest)))
        }
      }
      await Promise.all(movePromises)
      rm(resolve(outDir, relative(config.root, config.srcDir)))
    },
  }
}
