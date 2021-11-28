import { defineConfig } from 'iles'

import windicss from 'vite-plugin-windicss'
import inspect from 'vite-plugin-inspect'
import { imagetools } from 'vite-imagetools'
import type { ImageConfig } from 'imagetools-core'

export default defineConfig({
  siteUrl: 'https://the-vue-point-with-iles.netlify.app/',
  jsx: 'solid',
  svelte: true,
  modules: [
    '@islands/icons',
  ],
  markdown: {
    rehypePlugins: [
      ['@mapbox/rehype-prism', { alias: { markup: ['html', 'vue'] } }],
    ],
    // Example: Configure all posts to use a different layout without having to
    // add `layout: 'post'` in every file.
    extendFrontmatter (frontmatter, filename) {
      if (filename.includes('/posts/'))
        return { layout: 'post', ...frontmatter }
    },
  },
  vite: {
    plugins: [
      imagetools({
        resolveConfigs (config) {
          const obj = Object.fromEntries(config)
          if (obj.post) {
            return ['avif', 'webp', undefined].flatMap(format => [
              { width: 400, format, ...obj },
              { width: 758, format, ...obj },
            ])
          }
        },
        extendOutputFormats: (builtins) => ({ ...builtins,
          post: () => (metadatas) => {
            const byFormat = groupBy(metadatas, 'format')
            return Object.entries(byFormat).map(([format, metadatas]) => ({
              type: `image/${format === 'jpg' ? 'jpeg' : format}`,
              srcset: metadatas.map(meta => `${meta.src} ${meta.width}w`).join(', ')
            }))
          },
        }),
      }),
      windicss(),
      Boolean(process.env.DEBUG) && inspect(),
    ],
  },
})

function groupBy<T> (items: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  items.forEach(item => (result[item[key] as any] ||= []).push(item))
  return result
}
