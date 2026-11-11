/**
 * Логический стек навигации в sessionStorage — переживает reloadNuxtApp / PTR.
 * Нужен, потому что в TMA после обновления history часто «пустой» и Back закрывает Mini App.
 */

const STORAGE_KEY = 'worship-nav-stack'
const MAX_DEPTH = 40

function canUseStorage(): boolean {
  return import.meta.client && typeof sessionStorage !== 'undefined'
}

function readStack(): string[] {
  if (!canUseStorage()) return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is string => typeof item === 'string' && item.startsWith('/') && !item.startsWith('//'),
    )
  } catch {
    return []
  }
}

function writeStack(stack: string[]) {
  if (!canUseStorage()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_DEPTH)))
  } catch {
    /* private mode / quota */
  }
}

/** После cold start / PTR: текущий URL должен быть вершиной, история до него сохраняется. */
export function ensureAppNavStack(fullPath: string) {
  const stack = readStack()
  if (!stack.length) {
    writeStack([fullPath])
    return
  }
  const top = stack[stack.length - 1]
  if (top === fullPath) return

  const idx = stack.lastIndexOf(fullPath)
  if (idx >= 0) {
    writeStack(stack.slice(0, idx + 1))
    return
  }
  writeStack([...stack, fullPath])
}

/**
 * Обычный переход вперёд (не pop).
 * Корневые вкладки сбрасывают стек; иначе пушим / обновляем вершину.
 */
export function trackAppNavForward(toFullPath: string, fromFullPath: string, isRoot: (path: string) => boolean) {
  const toPath = toFullPath.split('?')[0] || toFullPath
  const fromPath = fromFullPath.split('?')[0] || fromFullPath
  const stack = readStack()

  if (isRoot(toPath)) {
    writeStack([toFullPath])
    return
  }

  if (!stack.length) {
    writeStack(isRoot(fromPath) ? [fromFullPath, toFullPath] : [toFullPath])
    return
  }

  const top = stack[stack.length - 1]
  if (top === toFullPath) return

  if (top === fromFullPath || (top?.split('?')[0] === fromPath && fromFullPath)) {
    writeStack([...stack, toFullPath])
    return
  }

  // replace-навигация / рассинхрон после reload — держим историю, меняем вершину
  if (top?.split('?')[0] === toPath) {
    writeStack([...stack.slice(0, -1), toFullPath])
    return
  }

  writeStack([...stack, toFullPath])
}

/** Pop текущей вершины; возвращает новый top или null. */
export function popAppNavStack(): string | null {
  const stack = readStack()
  if (stack.length <= 1) return null
  stack.pop()
  const prev = stack[stack.length - 1] ?? null
  writeStack(stack)
  return prev
}

export function peekAppNavStack(): string | null {
  const stack = readStack()
  return stack[stack.length - 1] ?? null
}

export function appNavStackDepth(): number {
  return readStack().length
}
