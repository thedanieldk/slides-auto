import type { CompositionResult } from "@/lib/composition"

export type SavedHook = {
  id: string
  text: string
  frameworkId: string
  createdAt: string
  generatedCopy?: CompositionResult
}

const HOOKS_STORAGE_KEY = "slides-auto.hooks.v1"
const FALLBACK_FRAMEWORK_ID = "five-step"

export function listSavedHooks(): SavedHook[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(HOOKS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSavedHook).map((hook) => ({
      ...hook,
      frameworkId: hook.frameworkId || FALLBACK_FRAMEWORK_ID,
    }))
  } catch {
    return []
  }
}

export function addSavedHooks(
  texts: string[],
  frameworkId: string
): SavedHook[] {
  const now = new Date().toISOString()
  const newHooks: SavedHook[] = texts.map((text) => ({
    id: crypto.randomUUID(),
    text,
    frameworkId,
    createdAt: now,
  }))

  const next = [...newHooks, ...listSavedHooks()]
  window.localStorage.setItem(HOOKS_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function deleteSavedHook(id: string): SavedHook[] {
  const next = listSavedHooks().filter((hook) => hook.id !== id)
  window.localStorage.setItem(HOOKS_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function saveHookCopy(
  id: string,
  result: CompositionResult
): SavedHook[] {
  const next = listSavedHooks().map((hook) =>
    hook.id === id ? { ...hook, generatedCopy: result } : hook
  )
  window.localStorage.setItem(HOOKS_STORAGE_KEY, JSON.stringify(next))
  return next
}

function isSavedHook(value: unknown): value is SavedHook {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SavedHook).id === "string" &&
    typeof (value as SavedHook).text === "string" &&
    typeof (value as SavedHook).createdAt === "string"
  )
}
