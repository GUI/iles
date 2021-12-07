import { defineConfig } from 'tsup'

const baseConfig = {
  dts: true,
  target: 'node14',
  splitting: true,
  sourcemap: false,
}

export default defineConfig((options) => {
  console.log({ options })
  if (options.entryPoints[0] === 'src/client') {
    console.log('here!')
    return {
      ...baseConfig,
      format: ['esm'],
      outDir: 'dist/client',
      external: [
        'components/App.vue',
        'components/DebugPanel.vue',
        'components/Head.vue',
        'components/Island.vue',
        'components/NotFound.vue',
      ],
    }
  }
  else {
    return {
      ...baseConfig,
      format: ['cjs'],
      outDir: 'dist/node',
      external: [
        '../../lib/modules',
        '@vue/runtime-dom/dist/runtime-dom.esm-bundler.js',
        'solid-js/web',
        'preact-render-to-string',
        '@islands/hydration/preact',
        '@islands/hydration/dist/hydration.js',
        '@islands/hydration/dist/vue.js',
        '@islands/hydration/dist/vanilla.js',
        '@islands/hydration/dist/solid.js',
        '@islands/hydration/dist/preact.js',
        '@islands/hydration/dist/svelte.js',
      ],
    }
  }
})
