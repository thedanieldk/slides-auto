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
      description: `Exactly ${IMAGE_QUERY_COUNT} short Pinterest search phrases (2-5 words each) for aesthetic background photos related to the niche.`,
    },
  },
  required: ["imageQueries"],
  additionalProperties: false,
} as const

const IMAGE_QUERIES_SYSTEM_PROMPT = `You write short Pinterest search phrases for aesthetic background photos to accompany social content about a product.

Given a product's name, niche, and value proposition, return ${IMAGE_QUERY_COUNT} distinct short search phrases (2 to 5 words each). Each phrase should evoke the general lifestyle, mood, or setting related to the niche — broad and aesthetic, never the literal specific product or topic.

For example, for a sleep aid product, prefer phrases like "cozy bedroom aesthetic" or "calm night routine" rather than "sleep aid" or anything mentioning sleep directly.

Vary the phrases so they cover different angles: mood, room or setting, activity, and color palette or atmosphere.`

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
