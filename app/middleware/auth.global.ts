import { useAuthStore } from '~/stores/auth'
import { useWorkspaceStore } from '~/stores/workspace'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const auth = useAuthStore()
  const workspace = useWorkspaceStore()

  if (!auth.ready) {
    await auth.init()
  }

  const publicPaths = ['/login', '/invite', '/auth/callback']
  const isPublic =
    publicPaths.some((p) => to.path === p || to.path.startsWith(`${p}/`)) ||
    to.meta.public === true

  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  // Always reload membership when store is incomplete (workspace without member used to skip this)
  if (auth.isAuthenticated && !workspace.hasWorkspace && !workspace.loading) {
    try {
      await workspace.loadCurrent()
    } catch {
      // continue; pages / onboarding handle empty state
    }
  }

  const needsWorkspace = !isPublic && to.path !== '/onboarding'
  if (auth.isAuthenticated && needsWorkspace && !workspace.hasWorkspace) {
    return navigateTo('/onboarding')
  }

  if (auth.isAuthenticated && workspace.hasWorkspace && to.path === '/onboarding') {
    return navigateTo('/')
  }

  if (auth.isAuthenticated && to.path === '/login') {
    return navigateTo((to.query.redirect as string) || '/')
  }
})
