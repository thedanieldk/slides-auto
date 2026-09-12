"use server"

import { and, desc, eq } from "drizzle-orm"

import type { CompositionResult } from "@/lib/composition"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { db } from "@/lib/db"
import { hooks } from "@/lib/db/schema"
import type { SavedHook } from "@/lib/hooks-storage"

function toSavedHook(row: typeof hooks.$inferSelect): SavedHook {
  return {
    id: row.id,
    text: row.text,
    frameworkId: row.frameworkId,
    productId: row.productId,
    createdAt: row.createdAt.toISOString(),
    generatedCopy: row.generatedCopy ?? undefined,
  }
}

export async function listSavedHooks(): Promise<SavedHook[]> {
  const userId = await getCurrentUserId()
  const rows = await db
    .select()
    .from(hooks)
    .where(eq(hooks.userId, userId))
    .orderBy(desc(hooks.createdAt))

  return rows.map(toSavedHook)
}

export async function addSavedHooks(
  texts: string[],
  frameworkId: string,
  productId: string
): Promise<SavedHook[]> {
  const userId = await getCurrentUserId()
  await db
    .insert(hooks)
    .values(texts.map((text) => ({ userId, productId, frameworkId, text })))

  return listSavedHooks()
}

export async function deleteSavedHook(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  await db.delete(hooks).where(and(eq(hooks.id, id), eq(hooks.userId, userId)))
}

export async function saveHookCopy(
  id: string,
  result: CompositionResult
): Promise<void> {
  const userId = await getCurrentUserId()
  await db
    .update(hooks)
    .set({ generatedCopy: result })
    .where(and(eq(hooks.id, id), eq(hooks.userId, userId)))
}
