export type EntityId = string

export type IsoDateTime = string

export interface Timestamps {
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}
