/**
 * Логический стек навигации в sessionStorage — переживает reloadNuxtApp / PTR.
 * Нужен, потому что в TMA после обновления history часто «пустой» и Back закрывает Mini App.
 */

const STORAGE_KEY = 'worship-nav-stack'
const MAX_DEPTH = 40

function canUseStorage(): boolean {
  return import.meta.client && typeof sessionStorage !== 'undefined'
}

function pathOnly(fullPath: string): string {
  return fullPath.split('?')[0] || fullPath
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
    // Убираем подряд идущие дубликаты (частый источник A↔B лупов)
    const deduped: string[] = []
    for (const item of stack) {
      if (deduped[deduped.length - 1] === item) continue
      deduped.push(item)
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(deduped.slice(-MAX_DEPTH)))
  } catch {
    /* private mode / quota */
  }
}

/** Жёстко задать стек (fallback / корень / анти-луп). */
export function resetAppNavStack(fullPath: string) {
  writeStack([fullPath])
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

  // Тот же path без query — обновляем вершину, не пушим
  if (top && pathOnly(top) === pathOnly(fullPath)) {
    writeStack([...stack.slice(0, -1), fullPath])
    return
  }

  const idx = stack.lastIndexOf(fullPath)
  if (idx >= 0) {
    writeStack(stack.slice(0, idx + 1))
    return
  }

  // fullPath как path без query уже был в стеке — обрезаем до него и обновляем query
  const pathIdx = stack.map(pathOnly).lastIndexOf(pathOnly(fullPath))
  if (pathIdx >= 0) {
    writeStack([...stack.slice(0, pathIdx), fullPath])
    return
  }

  writeStack([...stack, fullPath])
}

/**
 * Обычный переход вперёд (не pop).
 * Корневые вкладки сбрасывают стек; иначе пушим / обновляем вершину.
 */
export function trackAppNavForward(toFullPath: string, fromFullPath: string, isRoot: (path: string) => boolean) {
  const toPath = pathOnly(toFullPath)
  const fromPath = pathOnly(fromFullPath)
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

  // Не пушим A→B→A: если цель уже ниже вершины — обрезаем до неё
  const existingIdx = stack.map(pathOnly).lastIndexOf(toPath)
  if (existingIdx >= 0 && existingIdx < stack.length - 1) {
    writeStack([...stack.slice(0, existingIdx), toFullPath])
    return
  }

  if (top === fromFullPath || (top && pathOnly(top) === fromPath && fromFullPath)) {
    writeStack([...stack, toFullPath])
    return
  }

  // replace-навигация / рассинхрон после reload — держим историю, меняем вершину
  if (top && pathOnly(top) === toPath) {
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
