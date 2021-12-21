import type { IlesModule } from 'iles'

export * from './types'

/**
 * An iles module that installs vue-i18n in the site.
 */
export default function IlesI18n (): IlesModule {
  return {
    name: '@islands/i18n',
  }
}
