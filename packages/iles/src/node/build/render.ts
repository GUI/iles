/* eslint-disable @typescript-eslint/no-var-requires */
import { join, relative } from 'pathe'
import { renderHeadToString } from '@vueuse/head'
import { renderers } from '@islands/prerender'
import { IslandDefinition } from 'iles'
import type { Awaited, AppConfig, CreateAppFactory, IslandsByPath, CssFiles, RouteToRender } from '../shared'
import type { bundle } from './bundle'
import { withSpinner } from './utils'
import { getRoutesToRender } from './routes'

const commentsRegex = /<!--\[-->|<!--]-->|<!---->/g

export async function renderPages (
  config: AppConfig,
  islandsByPath: IslandsByPath,
  { clientResult }: Awaited<ReturnType<typeof bundle>>,
) {
  const { createApp }: { createApp: CreateAppFactory} = require(join(config.tempDir, 'app.js'))

  const routesToRender = await withSpinner('resolving static paths', async () =>
    await getRoutesToRender(config, createApp))

  const { cssByFile } = clientResult

  await withSpinner('rendering pages', async () => {
    for (const route of routesToRender)
      route.rendered = await renderPage(config, islandsByPath, cssByFile, route, createApp)
  })

  return { routesToRender }
}

export async function renderPage (
  config: AppConfig,
  islandsByPath: IslandsByPath,
  cssByFile: CssFiles,
  route: RouteToRender,
  createApp: CreateAppFactory,
) {
  const { app, head } = await createApp({ routePath: route.path, ssrProps: route.ssrProps })
  let content = await require('@vue/server-renderer').renderToString(app, { islandsByPath, renderers })

  // Remove comments from Vue renderer to allow plain text, RSS, or JSON output.
  content = content.replace(commentsRegex, '')

  if (!route.outputFilename.endsWith('.html')) console.log({ ...route, content })

  // Skip HTML shell to allow Vue to render plain text, RSS, or JSON output.
  if (!route.outputFilename.endsWith('.html'))
    return content

  const { headTags, htmlAttrs, bodyAttrs } = renderHeadToString(head)

  return `<!DOCTYPE html>
<html ${htmlAttrs}>
  <head>
    ${headTags}
    ${stylesheetTagsFrom(cssByFile, relative(config.root, route.sourceFilename))}
    ${await scriptTagsFrom(config, islandsByPath[route.path])}
  </head>
  <body ${bodyAttrs}>
    <div id="app">${content}</div>
  </body>
</html>`
}

function stylesheetTagsFrom (cssByFile: CssFiles, filename: string) {
  console.log('stylesheetTagsFrom', { filename, css: cssByFile[filename] })
  return cssByFile[filename]
    ?.map(href => `<link rel="stylesheet" href="${href}">`)
    ?.join('\n') || ''
}

async function scriptTagsFrom (config: AppConfig, islands: undefined | IslandDefinition[]) {
  const anySolid = islands?.some(island => island.script.includes('@islands/hydration/solid'))
  if (!anySolid) return ''
  return '<script>window._$HYDRATION={events:[],completed:new WeakSet()}</script>'
}
