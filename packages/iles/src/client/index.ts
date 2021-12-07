// exports in this file are exposed to the client app via 'iles'
// so the user can do `import { usePage } from 'iles'`

// Generic Types
export type { Router, RouteRecordRaw } from './shared'

// Composables
export { useAppConfig } from 'api/useAppConfig'
export { usePage } from 'api/usePage'
// export { useAsyncData } from 'api/useAsyncData'
// export { useFetch } from 'api/useFetch'
export { useMDXComponents, provideMDXComponents } from 'api/useMdxComponents'
export { useVueRenderer } from 'api/useVueRenderer'
export { useRouter, useRoute } from 'vue-router'
export { useHead } from '@vueuse/head'

import type { ComponentOptionsWithoutProps } from 'vue'
import type { UserApp, GetStaticPaths } from 'types'

export function defineApp (app: UserApp) {
  return app
}

export function definePageComponent<T> (page: ComponentOptionsWithoutProps<T> & { getStaticPaths?: GetStaticPaths<T> }) {
  return page
}
