import { z } from "zod"

import { copyFormatIds } from "@/lib/ai/copy-formats"
import { productProfileDraftSchema } from "@/lib/products/product-profile"
import { slideLayoutIds, textStyleIds } from "@/lib/slideshow"

export const conceptCopyFormatIds = [
  "personal-results",
  "helpful-habits",
] as const

export const generatedConceptSchema = z.object({
  hook: z.string().trim().min(1).max(500),
  angle: z.string().trim().min(1).max(500),
  productPlacement: z.string().trim().min(1).max(500),
  copyFormatId: z.enum(conceptCopyFormatIds),
})

export const generatedConceptsSchema = z.object({
  concepts: z.array(generatedConceptSchema).length(3),
})

export const generatedConceptResponseSchema = z
  .object({
    conceptOne: generatedConceptSchema,
    conceptTwo: generatedConceptSchema,
    conceptThree: generatedConceptSchema,
  })
  .transform(({ conceptOne, conceptTwo, conceptThree }) => ({
    concepts: [conceptOne, conceptTwo, conceptThree],
  }))

export const generatedSlideSchema = z.object({
  hook: z.string().trim().min(1).max(120),
  body: z.string().trim().max(180),
  imageQuery: z.string().trim().min(1).max(100),
  layoutId: z.enum(textStyleIds),
})

export const generatedSlideshowSchema = z.object({
  title: z.string().trim().min(1).max(80),
  slides: z.array(generatedSlideSchema).min(2).max(10),
})

export const slideshowGenerationRequestSchema = z.object({
  mode: z.literal("slideshow"),
  concept: generatedConceptSchema,
  slideCount: z.number().int().min(2).max(10),
  layoutId: z.enum(textStyleIds),
  product: productProfileDraftSchema,
})

export const conceptGenerationRequestSchema = z.object({
  mode: z.literal("concepts"),
  copyFormatId: z.enum(copyFormatIds),
  product: productProfileDraftSchema,
})

export const slideRewriteRequestSchema = z.object({
  mode: z.literal("slide"),
  projectTitle: z.string().trim().max(120),
  slideIndex: z.number().int().min(0).max(9),
  slideCount: z.number().int().min(1).max(10),
  currentHook: z.string().trim().max(120),
  currentBody: z.string().trim().max(180),
  previousHook: z.string().trim().max(120).nullable(),
  nextHook: z.string().trim().max(120).nullable(),
  layoutId: z.enum(slideLayoutIds),
})

export const generationRequestSchema = z.discriminatedUnion("mode", [
  conceptGenerationRequestSchema,
  slideshowGenerationRequestSchema,
  slideRewriteRequestSchema,
])

export type GeneratedConcept = z.infer<typeof generatedConceptSchema>
export type GeneratedSlide = z.infer<typeof generatedSlideSchema>
export type GeneratedSlideshow = z.infer<typeof generatedSlideshowSchema>
export type GenerationRequest = z.infer<typeof generationRequestSchema>

const slideProperties = {
  hook: {
    type: "string",
    description: "Short headline, no more than 120 characters.",
  },
  body: {
    type: "string",
    description: "Optional supporting copy, no more than 180 characters.",
  },
  imageQuery: {
    type: "string",
    description:
      "Three to seven concrete terms describing a candid, portrait-friendly photograph with a visible subject, action, or setting.",
  },
  layoutId: {
    type: "string",
    enum: textStyleIds,
  },
} as const

const conceptProperties = {
  hook: {
    type: "string",
    description: "The opening hook for this concept, up to 120 characters.",
  },
  angle: {
    type: "string",
    description:
      "One short sentence, ideally under 180 characters, summarizing what the slideshow will explore.",
  },
  productPlacement: {
    type: "string",
    description:
      "One short sentence, ideally under 160 characters, explaining how the product appears naturally.",
  },
  copyFormatId: {
    type: "string",
    enum: conceptCopyFormatIds,
  },
} as const

export const conceptsOutputJsonSchema = {
  type: "object",
  properties: {
    conceptOne: createConceptJsonSchema(),
    conceptTwo: createConceptJsonSchema(),
    conceptThree: createConceptJsonSchema(),
  },
  required: ["conceptOne", "conceptTwo", "conceptThree"],
  additionalProperties: false,
} as const

function createConceptJsonSchema() {
  return {
    type: "object",
    properties: conceptProperties,
    required: ["hook", "angle", "productPlacement", "copyFormatId"],
    additionalProperties: false,
  } as const
}

export const slideshowOutputJsonSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "A short working title for the slideshow.",
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: slideProperties,
        required: ["hook", "body", "imageQuery", "layoutId"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "slides"],
  additionalProperties: false,
} as const

export const slideOutputJsonSchema = {
  type: "object",
  properties: slideProperties,
  required: ["hook", "body", "imageQuery", "layoutId"],
  additionalProperties: false,
} as const
