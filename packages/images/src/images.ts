import { remarkPlugin } from './remark-plugin'

/**
 * An iles module that injects a remark plugin to extract and import sources in
 * img and srcset so that Vite can perform import analysis and fingerprint them.
 */
export default function IlesMDXImages (): any {
  return {
    name: '@islands/images',
    markdown: {
      remarkPlugins: [
        remarkPlugin,
      ],
    },
  }
}

export { remarkPlugin }
