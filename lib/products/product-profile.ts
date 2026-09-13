import { z } from "zod"

export const productProfileDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  niche: z.string().trim().min(1).max(120),
  valueProposition: z.string().trim().min(1).max(280),
})

export const productProfileSchema = productProfileDraftSchema.extend({
  id: z.string().min(1),
  sourceUrl: z.string().url(),
  createdAt: z.string().datetime(),
})

export const productProfileAnalysisSchema = productProfileDraftSchema.extend({
  sourceUrl: z.string().url(),
})

export const storedProductProfilesSchema = z.array(productProfileSchema).max(20)

export const productProfileRequestSchema = z.object({
  url: z.string().trim().min(3).max(250),
})

export type ProductProfileDraft = z.infer<typeof productProfileDraftSchema>
export type ProductProfile = z.infer<typeof productProfileSchema>

export const productProfileOutputJsonSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The product name shown on the source page.",
    },
    niche: {
      type: "string",
      description: "A short, specific category for the product.",
    },
    valueProposition: {
      type: "string",
      description:
        "One plain-language sentence explaining who the product helps and the main outcome it provides.",
    },
  },
  required: ["name", "niche", "valueProposition"],
  additionalProperties: false,
} as const
