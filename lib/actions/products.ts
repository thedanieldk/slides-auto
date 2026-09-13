"use server"

import { and, desc, eq } from "drizzle-orm"

import { getCurrentUserId } from "@/lib/auth/current-user"
import { db } from "@/lib/db"
import { productProfiles } from "@/lib/db/schema"
import type { ProductProfile } from "@/lib/products/product-profile"

function toProductProfile(
  row: typeof productProfiles.$inferSelect
): ProductProfile {
  return {
    id: row.id,
    name: row.name,
    niche: row.niche,
    valueProposition: row.valueProposition,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listProductProfiles(): Promise<ProductProfile[]> {
  const userId = await getCurrentUserId()
  const rows = await db
    .select()
    .from(productProfiles)
    .where(eq(productProfiles.userId, userId))
    .orderBy(desc(productProfiles.createdAt))

  return rows.map(toProductProfile)
}

export async function upsertProductProfile(draft: {
  name: string
  niche: string
  valueProposition: string
  sourceUrl: string
}): Promise<ProductProfile> {
  const userId = await getCurrentUserId()

  const [existing] = await db
    .select()
    .from(productProfiles)
    .where(
      and(
        eq(productProfiles.userId, userId),
        eq(productProfiles.sourceUrl, draft.sourceUrl)
      )
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(productProfiles)
      .set({
        name: draft.name,
        niche: draft.niche,
        valueProposition: draft.valueProposition,
      })
      .where(eq(productProfiles.id, existing.id))
      .returning()
    return toProductProfile(updated!)
  }

  const [created] = await db
    .insert(productProfiles)
    .values({ ...draft, userId })
    .returning()
  return toProductProfile(created!)
}

export async function deleteProductProfile(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  await db
    .delete(productProfiles)
    .where(and(eq(productProfiles.id, id), eq(productProfiles.userId, userId)))
}
