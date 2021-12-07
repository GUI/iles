<script lang="ts">
import { defineComponent, computed, shallowRef, watch } from 'vue'
import { Head } from '@vueuse/head'
import { useAppConfig } from 'api/useAppConfig'
import { usePage } from 'api/usePage'
import { resolveLayout } from 'api/resolveLayout'
import { resolveProps } from 'api/resolveProps'

export default defineComponent({
  name: 'îles',
  components: {
    Head,
  },
  async setup () {
    const appConfig = useAppConfig()

    const { page, route, props } = usePage()

    const layoutName = computed(() => page.value.layoutName)
    const layout = computed(() => route.meta.layout?.value)
    if (import.meta.env.DEV) {
      // HMR for layout changes
      watch([page, layoutName], async ([page], [oldPage]) => {
        if (page === oldPage) await resolveLayout(route)
      })

      // HMR for static path changes
      const getStaticPaths = computed(() => page.value.getStaticPaths)
      watch([page, getStaticPaths], async ([page], [oldPage]) => {
        if (page === oldPage) await resolveProps(route)
      })
    }

    const DebugPanel = shallowRef<null | typeof import('./DebugPanel.vue').default>(null)
    if (import.meta.env.DEV && appConfig.debug)
      import('./DebugPanel.vue').then(m => DebugPanel.value = m.default)

    if (import.meta.env.DEV) {
      const { useRouterLinks } = await import('api/useRouterLinks')
      useRouterLinks()
    }

    return {
      layout,
      page,
      props,
      DebugPanel,
    }
  },
})
</script>

<template>
  <Head>
    <meta property="generator" content="îles">
  </Head>
  <Suspense>
    <router-view>
      <component :is="page" v-if="layout === false" v-bind="props"/>
      <component :is="layout" v-else :key="page.__file">
        <template #default="layoutProps">
          <component :is="page" v-bind="{ ...layoutProps, ...props }"/>
        </template>
      </component>
    </router-view>
  </Suspense>
  <template v-if="DebugPanel">
    <component :is="DebugPanel"/>
  </template>
</template>
