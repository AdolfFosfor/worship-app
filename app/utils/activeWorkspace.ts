const ACTIVE_WORKSPACE_KEY = 'worship-active-workspace'

export function readActiveWorkspaceId(): string | null {
  if (!import.meta.client) return null
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    return null
  }
}

export function writeActiveWorkspaceId(id: string | null) {
  if (!import.meta.client) return
  try {
    if (id) localStorage.setItem(ACTIVE_WORKSPACE_KEY, id)
    else localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
  } catch {
    // private mode / storage blocked
  }
}
