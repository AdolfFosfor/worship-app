/**
 * Shared API client types.
 * Concrete endpoint contracts will be added after backend agreement.
 */

export interface ApiErrorBody {
  message?: string
  code?: string
  details?: unknown
}

export interface ApiError {
  statusCode: number
  statusMessage: string
  data?: ApiErrorBody | null
}

export type ApiRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions<TBody = unknown> {
  method?: ApiRequestMethod
  body?: TBody
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  signal?: AbortSignal
}
