<script lang="ts">
import { defineAsyncComponent, defineComponent, h, createCommentVNode, createStaticVNode } from 'vue'
import type { PropType, DefineComponent } from 'vue'
import type { Framework } from '@islands/hydration'
import { useIslandsForPath } from 'api/useIslandsForPath'
import { useRenderer } from 'api/useRenderer'
import { useAppConfig } from 'api/useAppConfig'
import { useVueRenderer } from 'api/useVueRenderer'
import serialize from '@nuxt/devalue'
import { isEager, newHydrationId, Hydrate, hydrationFns } from '../hydration'

function inspectMediaQuery (query: string) {
  if (!query.includes('(') && query.includes(': '))
    console.warn('You might need to add parenthesis to the following media query.\n\t', query, '\n', 'https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries#targeting_media_features')
  return query
}

export default defineComponent({
  name: 'Island',
  inheritAttrs: false,
  props: {
    component: { type: [Object, Function, null] as PropType<DefineComponent>, required: true },
    componentName: { type: String, required: true },
    importName: { type: String, required: true },
    importPath: { type: String, required: true },
    using: { type: String as PropType<Framework>, default: undefined },
    [Hydrate.WhenIdle]: { type: Boolean, default: false },
    [Hydrate.OnLoad]: { type: Boolean, default: false },
    [Hydrate.MediaQuery]: { type: [Boolean, String], default: false },
    [Hydrate.SkipPrerender]: { type: Boolean, default: false },
    [Hydrate.WhenVisible]: { type: Boolean, default: false },
    [Hydrate.None]: { type: Boolean, default: false },
  },
  setup (props, { attrs }) {
    let strategy = Object.values(Hydrate).find(s => props[s])
    if (!strategy) {
      console.warn('Unknown hydration strategy, falling back to client:load. Received:', { ...attrs })
      strategy = Hydrate.OnLoad
    }

    const ext = props.importPath.split('.')[1]
    const appConfig = useAppConfig()
    const framework: Framework = props.using
      || (ext === 'svelte' && 'svelte')
      || ((ext === 'js' || ext === 'ts') && 'vanilla')
      || ((ext === 'jsx' || ext === 'tsx') && appConfig.jsx)
      || 'vue'

    return {
      id: newHydrationId(),
      strategy,
      framework,
      appConfig,
      islandsForPath: import.meta.env.SSR && strategy !== Hydrate.None ? useIslandsForPath() : undefined,
      renderVNodes: useVueRenderer(),
      prerender: import.meta.env.SSR ? useRenderer(framework) : undefined,
    }
  },
  mounted () {
    (window as any).__ILE_DEVTOOLS__?.addIslandToDevtools(this)
  },
  unmounted () {
    (window as any).__ILE_DEVTOOLS__?.removeIslandFromDevtools(this)
  },
  render () {
    const isSSR = import.meta.env.SSR

    const props = { ...this.$attrs }
    if (this.strategy === Hydrate.MediaQuery)
      props._mediaQuery = inspectMediaQuery(this.$props[Hydrate.MediaQuery] as string)

    const slotVNodes = mapObject(this.$slots, slotFn => slotFn?.())
    const hydrationPkg = `${isSSR ? '' : '/@id/'}@islands/hydration`
    let renderedSlots: Record<string, string>

    const renderSlots = async () =>
      renderedSlots ||= await asyncMapObject(slotVNodes, this.renderVNodes)

    const renderScript = async () => {
      const slots = await renderSlots()
      const componentPath = this.importPath.replace(this.appConfig.root, '')
      const frameworkPath = `${hydrationPkg}/${this.framework}`

      return `import { ${hydrationFns[this.strategy]} as hydrate } from '${hydrationPkg}'
${isEager(this.strategy)
    ? `import framework from '${frameworkPath}'
import { ${this.importName} as component } from '${componentPath}'`
    : `const framework = async () => (await import('${frameworkPath}')).default
const component = async () => (await import('${componentPath}')).${this.importName}`
}
hydrate(framework, component, '${this.id}', ${serialize(props)}, ${serialize(slots)})
  `
    }

    const renderPlaceholder = async () => {
      const placeholder = `ISLAND_HYDRATION_PLACEHOLDER_${this.id}`
      const script = await renderScript()
      const componentPath = this.importPath
      this.islandsForPath!.push({ id: this.id, script, componentPath, placeholder })
      return placeholder
    }

    const prerenderIsland = () => {
      if (this.strategy === Hydrate.SkipPrerender) return undefined

      if (this.framework === 'vanilla') return undefined

      if (this.framework === 'vue')
        return h(this.component, this.$attrs, this.$slots)

      const prerender = this.prerender
      if (!prerender) return undefined

      return h(defineAsyncComponent(async () => {
        const slots = await renderSlots()
        const result = await prerender(this.component, this.$attrs, slots)
        return createStaticVNode(result, undefined as any)
      }))
    }

    const ileRoot = h('ile-root', { id: this.id }, prerenderIsland())

    if (isSSR && this.strategy === Hydrate.None)
      return ileRoot

    return [
      ileRoot,
      h(defineAsyncComponent(async () =>
        isSSR
          ? createCommentVNode(await renderPlaceholder())
          : h('script', { async: true, type: 'module', innerHTML: await renderScript() })),
      ),
    ]
  },
})

function mapObject<I, O> (obj: Record<string, I>, fn: (i: I, key?: string) => O): Record<string, O> {
  const result: Record<string, O> = {}
  for (const key in obj)
    result[key] = fn(obj[key], key)
  return result
}

async function asyncMapObject<I, O> (obj: Record<string, I>, fn: (i: I) => Promise<O>): Promise<Record<string, O>> {
  const result: Record<string, O> = {}
  for (const key in obj)
    result[key] = await fn(obj[key])
  return result
}
</script>

<style>
ile-root {
  display: contents
}
</style>
