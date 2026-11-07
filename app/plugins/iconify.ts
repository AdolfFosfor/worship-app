import { addCollection } from '@iconify/vue'
import type { IconifyJSON } from '@iconify/types'
import solar from '~/assets/icons/solar.json'

export default defineNuxtPlugin(() => {
  // Локальный subset (~17KB), не весь @iconify-json/solar (~12MB)
  addCollection(solar as IconifyJSON)
})
