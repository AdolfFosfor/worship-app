/**
 * Bootstrap: Visual Viewport → --app-keyboard-inset.
 */

import { useKeyboardInset } from '~/composables/useKeyboardInset'

export default defineNuxtPlugin(() => {
  useKeyboardInset().start()
})
