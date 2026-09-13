import "server-only"
import { z } from "zod"

import { requestAnthropicJson } from "@/lib/ai/anthropic"

const IMAGE_QUERY_COUNT = 6

const productImageQueriesSchema = z.object({
  imageQueries: z
    .array(z.string().trim().min(2).max(60))
    .length(IMAGE_QUERY_COUNT),
})

const productImageQueriesJsonSchema = {
  type: "object",
  properties: {
    imageQueries: {
      type: "array",
      items: { type: "string" },
      description: `Exactly ${IMAGE_QUERY_COUNT} short Pinterest search phrases (3-6 words each) that all share one consistent candid, warm photo style, varying only the subject.`,
    },
  },
  required: ["imageQueries"],
  additionalProperties: false,
} as const

const IMAGE_QUERIES_SYSTEM_PROMPT = `You write short Pinterest search phrases for candid, personal-style aesthetic photos to accompany social content about a product — the kind of photo diary feed where every slide feels like it belongs to the same set.

Given a product's name, niche, and value proposition, return exactly ${IMAGE_QUERY_COUNT} distinct search phrases (3 to 6 words each). All ${IMAGE_QUERY_COUNT} phrases must share the same visual treatment: candid, personal, iPhone-photo style with natural, warm, soft lighting. Vary ONLY the subject or setting between phrases (a different room, activity, or object related to the niche) — never the mood, lighting, color palette, or overall vibe. The phrases should read like they would return photos from the same photo diary, not different aesthetics.

Each phrase should evoke the general lifestyle or setting related to the niche — broad and aesthetic, never the literal specific product or topic. Include a word like "candid" or "aesthetic" in most phrases to bias toward real personal photography instead of staged, professional, or real-estate-style stock photos.

Good example set for a sleep aid product (consistent candid/warm style, varied subject): "candid bedroom morning light", "cozy blanket candid aesthetic", "candid nightstand still life", "morning stretch candid photo", "candid cup of tea aesthetic", "soft candid pillow details".

Bad example (do not do this): mixing "dramatic sunset skylight bedroom" with "ocean waves aesthetic" — these have completely different moods, lighting, and settings and would look mismatched next to each other.`

export async function generateProductImageQueries(product: {
  name: string
  niche: string
  valueProposition: string
}): Promise<string[] | null> {
  const result = await requestAnthropicJson({
    maxTokens: 400,
    system: IMAGE_QUERIES_SYSTEM_PROMPT,
    prompt: `Product: ${product.name}\nNiche: ${product.niche}\nValue proposition: ${product.valueProposition}`,
    schema: productImageQueriesJsonSchema,
  })

  if (!result.ok) return null

  const parsed = productImageQueriesSchema.safeParse(result.data)
  return parsed.success ? parsed.data.imageQueries : null
}
