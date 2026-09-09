import { z } from "zod"

export const imageSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(100),
})

export const imageSearchResultSchema = z.object({
  id: z.string().min(1),
  alt: z.string(),
  photographer: z.string().min(1),
  photographerUrl: z.string().url(),
  photoUrl: z.string().url(),
  previewUrl: z.string().url(),
  imageUrl: z.string().url(),
  provider: z.literal("pexels"),
})

export const imageSearchResponseSchema = z.object({
  results: z.array(imageSearchResultSchema),
})

export type ImageSearchResult = z.infer<typeof imageSearchResultSchema>

export type ImageProvider = {
  search(query: string): Promise<ImageSearchResult[]>
}
