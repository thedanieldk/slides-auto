import { z } from "zod"

export const DEFAULT_IMAGE_QUERY = "girl aesthetic faceless wellness warm"

export const imageSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).optional(),
})

export const imageSearchResultSchema = z.object({
  id: z.string().min(1),
  alt: z.string(),
  photographer: z.string().min(1),
  photographerUrl: z.string().url(),
  photoUrl: z.string().url(),
  previewUrl: z.string().url(),
  imageUrl: z.string().url(),
  provider: z.literal("pinterest"),
})

export const imageSearchResponseSchema = z.object({
  results: z.array(imageSearchResultSchema),
})

export type ImageSearchResult = z.infer<typeof imageSearchResultSchema>

export type ImageProvider = {
  search(query: string, limit?: number): Promise<ImageSearchResult[]>
}

/**
 * Assigns each of `count` slots a query from `pool`, shuffled once so
 * consecutive slots get different phrases (wrapping around if there are
 * more slots than pool entries) instead of picking with replacement.
 */
export function pickImageQueries(
  pool: string[] | null | undefined,
  count: number
): string[] {
  if (!pool || pool.length === 0) {
    return Array.from({ length: count }, () => DEFAULT_IMAGE_QUERY)
  }

  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }

  return Array.from(
    { length: count },
    (_, index) => shuffled[index % shuffled.length]!
  )
}
