/* eslint-disable no-restricted-syntax */
import { promises as fs } from 'fs'
import type { OutputAsset, OutputChunk, OutputOptions, PreRenderedAsset, PreRenderedChunk, RollupOutput } from 'rollup'
import type { Plugin } from 'vite'
import glob from 'fast-glob'
import { basename, relative, dirname, resolve } from 'pathe'
import { build, mergeConfig as mergeViteConfig, UserConfig as ViteUserConfig } from 'vite'
import { APP_PATH } from '../alias'
import { AppConfig, CssFiles } from '../shared'
import IslandsPlugins from '../plugin/plugin'
import { uniq, rm } from './utils'

type Entrypoints = Record<string, string>

// Internal: Bundles the Islands app for both client and server.
//
// Multi-entry build: every page is considered an entry chunk.
export async function bundle (config: AppConfig) {
  const cssByFile: CssFiles = {}

  const [clientResult, serverResult,] = await Promise.all([
    bundleClient(config, cssByFile),
    bundleSSR(config),
  ])

  return { clientResult: { ...clientResult, cssByFile }, serverResult }
}

async function bundleClient (config: AppConfig, cssByFile: CssFiles) {
  const { root, assetsDir } = config
  const files = glob.sync(resolve(config.pagesDir, './**/*'), { cwd: root })
    .map(file => relative(root, file))

  // NOTE: In order to extract CSS files used in a page, a virtual HTML entry is
  // added per page, allowing the Vite html plugin to inject links to the
  // stylesheets which are extracted using a regex.
  const entrypoints = Object.fromEntries(
    files.map(file => [file, file.replace(/\.\w+$/, '.html')]))

  function assetFileNames (asset: PreRenderedAsset | PreRenderedChunk) {
    const name = asset.name?.replace(/(?:user\-(?:app|site))|(?:jsx\-runtime)/, 'site') || 'name'
    return `${assetsDir}/${basename(name).replace(/[^\w\.]/g, '').split('.', 2)[0]}.[hash].[ext]`
  }

  function chunkFileNames (chunk: PreRenderedChunk) {
    return assetFileNames(chunk).replace('[ext]', 'js')
  }

  return await bundleWithVite(config, entrypoints, {
    ssr: false,
    cssByFile,
    output: { assetFileNames, chunkFileNames, entryFileNames: chunkFileNames },
  })
}

async function bundleSSR (config: AppConfig) {
  return await bundleWithVite(config, { app: APP_PATH }, { ssr: true })
}

// Internal: Creates a client and server bundle.
// NOTE: The client bundle is used only to obtain styles, JS is discarded.
async function bundleWithVite (config: AppConfig, entrypoints: Entrypoints, options: { ssr: boolean, cssByFile?: CssFiles, output?: OutputOptions }) {
  const { ssr, cssByFile, output } = options

  return await build(mergeViteConfig(config.vite, {
    logLevel: 'warn',
    ssr: {
      external: ['vue', '@vue/server-renderer'],
      noExternal: ['iles'],
    },
    plugins: [
      IslandsPlugins(config),
      !ssr && clientPlugins(config, entrypoints, cssByFile!),
    ],
    build: {
      ssr,
      cssCodeSplit: !ssr,
      minify: ssr ? false : 'esbuild',
      emptyOutDir: ssr,
      outDir: ssr ? config.tempDir : config.outDir,
      rollupOptions: {
        input: entrypoints,
        output: { ...output, ...config.vite.build?.rollupOptions?.output },
        preserveEntrySignatures: 'allow-extension',
        treeshake: !ssr,
      },
    },
  } as ViteUserConfig)) as RollupOutput
}

// NOTE: Would be a lot simpler if Vite exposed `chunkToEmittedCssFileMap`.
function clientPlugins (config: AppConfig, entrypoints: Entrypoints, cssByFile: CssFiles): Plugin[] {
  const { root } = config

  const pagesByHtmlEntrypoint = Object.fromEntries(Object.entries(entrypoints)
    .filter(([file, htmlFile]) => !file.endsWith('.html'))
    .map(entry => entry.reverse()))

  const htmlFiles = new Set(
    Object.keys(entrypoints).filter(file => file.endsWith('.html'))
      .map(file => relative(config.root, file)))

  const trackUsedJsFiles = htmlFiles.size > 0

  return [
    {
      name: 'iles:build:virtual-entrypoints',
      resolveId (id) {
        if (pagesByHtmlEntrypoint[relative(root, id)])
          return id
      },
      // NOTE: Returns a fake HTML file that references the actual entrypoint.
      load (id) {
        const pageFilename = pagesByHtmlEntrypoint[relative(root, id)]
        if (pageFilename)
          return `<script type="module" src="/${pageFilename}"></script>`
      }
    },
    {
      name: 'iles:build:client-imports',
      enforce: 'post',
      // NOTE: Ensures styles imported in app.ts are detected as dependencies.
      transform (code, id) {
        if (entrypoints[relative(root, id)] && !id.endsWith('.html'))
          return `import '@islands/user-app';import '@islands/user-site';${code}`
      },
    },
    {
      name: 'iles:build:extract-assets',
      enforce: 'post',
      generateBundle (_options, bundle) {
        const usedJsFileNames = new Set()

        function trackUsedJs (file: string) {
          if (usedJsFileNames.has(file)) return
          usedJsFileNames.add(file)
          const usedChunk = bundle[file] as OutputChunk & { imports?: string[] }
          usedChunk.imports?.forEach(trackUsedJs)
        }

        for (const name in bundle) {
          const chunk = bundle[name]
          if (chunk.type !== 'asset') continue

          // NOTE: Extracts the injected stylesheet links from the fake HTML file.
          const entryFile = pagesByHtmlEntrypoint[chunk.fileName]
          if (entryFile)
            cssByFile[entryFile] = extractStylesheets(chunk)
          else if (trackUsedJsFiles && chunk.fileName.endsWith('.html'))
            extractScripts(chunk, config.base).forEach(trackUsedJs)
        }

        for (const name in bundle) {
          const chunk = bundle[name]

          if (chunk.type === 'chunk' && (!trackUsedJsFiles || !usedJsFileNames.has(chunk.fileName)))
            delete bundle[name]
        }
      },
    },
    {
      name: 'iles:build:move-html-pages',
      enforce: 'post',
      // NOTE: Moves any raw .html pages to their correct location in outDir.
      // /dist/src/pages/examples/simple.html => /dist/examples/simple.html
      async writeBundle (_options, bundle) {
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
  ]
}

function extractStylesheets (chunk: OutputAsset) {
  const html = chunk.source as string
  const matches = Array.from(html.matchAll(/<link\b.*?\bhref="(.*?\.css)"[^>]*?>/g))
  console.log({ html, css: matches.map(([, href]) => href) })
  return uniq(matches.map(([, href]) => href))
}

function extractScripts (chunk: OutputAsset, base: string) {
  const html = chunk.source as string
  const matches = html.matchAll(/<(?:script|link)\b.*?\b(?:src|href)="(.*?\.js)"[^>]*?>/g)
  return uniq(Array.from(matches).map(([, src]) => src.replace(base, '')))
}
