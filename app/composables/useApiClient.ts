import { createApiClient, type ApiClient } from '~/utils/api/client'

let cachedBaseUrl: string | null = null
let cachedClient: ApiClient | null = null

/**
 * Centralized API client bound to `NUXT_PUBLIC_API_BASE_URL`.
 * Endpoint contracts will be added after backend agreement.
 */
export function useApiClient(): ApiClient {
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.apiBaseUrl ?? '')

  if (!cachedClient || cachedBaseUrl !== baseUrl) {
    cachedClient = createApiClient(baseUrl)
    cachedBaseUrl = baseUrl
  }

  return cachedClient
}
