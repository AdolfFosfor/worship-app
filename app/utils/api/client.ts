import type { ApiError, ApiRequestMethod, ApiRequestOptions } from '~/types/api'

function resolveUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!normalizedBase) {
    return normalizedPath
  }

  return `${normalizedBase}${normalizedPath}`
}

function toApiError(error: unknown): ApiError {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const fetchError = error as {
      statusCode?: number
      statusMessage?: string
      data?: ApiError['data']
      message?: string
    }

    return {
      statusCode: fetchError.statusCode ?? 500,
      statusMessage: fetchError.statusMessage ?? fetchError.message ?? 'Request failed',
      data: fetchError.data ?? null,
    }
  }

  return {
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : 'Unknown API error',
    data: null,
  }
}

export function createApiClient(baseUrl: string) {
  async function request<TResponse, TBody = unknown>(
    path: string,
    options: ApiRequestOptions<TBody> = {},
  ): Promise<TResponse> {
    const method: ApiRequestMethod = options.method ?? 'GET'

    try {
      return await $fetch<TResponse>(resolveUrl(baseUrl, path), {
        method,
        query: options.query,
        headers: options.headers,
        signal: options.signal,
        body: options.body as BodyInit | Record<string, unknown> | null | undefined,
      })
    } catch (error) {
      throw toApiError(error)
    }
  }

  return {
    request,
    get<TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
      return request<TResponse>(path, { ...options, method: 'GET' })
    },
    post<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      options?: Omit<ApiRequestOptions<TBody>, 'method' | 'body'>,
    ) {
      return request<TResponse, TBody>(path, { ...options, method: 'POST', body })
    },
    put<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      options?: Omit<ApiRequestOptions<TBody>, 'method' | 'body'>,
    ) {
      return request<TResponse, TBody>(path, { ...options, method: 'PUT', body })
    },
    patch<TResponse, TBody = unknown>(
      path: string,
      body?: TBody,
      options?: Omit<ApiRequestOptions<TBody>, 'method' | 'body'>,
    ) {
      return request<TResponse, TBody>(path, { ...options, method: 'PATCH', body })
    },
    delete<TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
      return request<TResponse>(path, { ...options, method: 'DELETE' })
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
