import { z } from "zod"

import { copyFormatIds } from "@/lib/ai/copy-formats"
import { DEFAULT_IMAGE_QUERY } from "@/lib/images/image-provider"
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

export const generatedSlideSchema = z
  .object({
    hook: z.string().trim().min(1),
    body: z.string().trim(),
    layoutId: z.enum(slideLayoutIds),
  })
  .transform((slide) => ({
    ...slide,
    hook: limitText(slide.hook, 120),
    body: limitText(slide.body, 180),
    imageQuery: DEFAULT_IMAGE_QUERY,
  }))

export const generatedSlideshowSchema = z
  .object({
    title: z.string().trim().min(1),
    slides: z.array(generatedSlideSchema).min(2).max(10),
  })
  .transform((slideshow) => ({
    ...slideshow,
    title: limitText(slideshow.title, 80),
  }))

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

export const HOOK_BATCH_SIZE = 8

const hookKeys = Array.from(
  { length: HOOK_BATCH_SIZE },
  (_, index) => `hook${index + 1}`
)

export const generatedHooksSchema = z.object({
  hooks: z.array(z.string().trim().min(1).max(240)).length(HOOK_BATCH_SIZE),
})

export const hooksGenerationRequestSchema = z.object({
  mode: z.literal("hooks"),
  examples: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  product: productProfileDraftSchema,
})

export const slideshowFromHookRequestSchema = z.object({
  mode: z.literal("slideshow-from-hook"),
  hook: z.string().trim().min(1).max(240),
  slideCount: z.number().int().min(2).max(10),
  layoutId: z.enum(textStyleIds),
  product: productProfileDraftSchema,
})

export const generationRequestSchema = z.discriminatedUnion("mode", [
  conceptGenerationRequestSchema,
  slideshowGenerationRequestSchema,
  slideRewriteRequestSchema,
  hooksGenerationRequestSchema,
  slideshowFromHookRequestSchema,
])

export type GeneratedConcept = z.infer<typeof generatedConceptSchema>
export type GeneratedSlide = z.infer<typeof generatedSlideSchema>
export type GeneratedSlideshow = z.infer<typeof generatedSlideshowSchema>
export type GeneratedHooks = z.infer<typeof generatedHooksSchema>
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
  layoutId: {
    type: "string",
    enum: slideLayoutIds,
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

export function createSlideshowOutputJsonSchema(slideCount: number) {
  const slideKeys = Array.from(
    { length: slideCount },
    (_, index) => `slide${index + 1}`
  )
  const slideSchema = {
    type: "object",
    properties: slideProperties,
    required: ["hook", "body", "layoutId"],
    additionalProperties: false,
  } as const

  return {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A short working title for the slideshow.",
      },
      slides: {
        type: "object",
        description: `Exactly ${slideCount} slides in reading order.`,
        properties: Object.fromEntries(
          slideKeys.map((key) => [key, slideSchema])
        ),
        required: slideKeys,
        additionalProperties: false,
      },
    },
    required: ["title", "slides"],
    additionalProperties: false,
  } as const
}

export function normalizeGeneratedSlideshow(
  value: unknown,
  slideCount: number
): unknown {
  if (!isRecord(value) || Array.isArray(value.slides)) return value
  if (!isRecord(value.slides)) return value
  const numberedSlides = value.slides

  const slides = Array.from(
    { length: slideCount },
    (_, index) => numberedSlides[`slide${index + 1}`]
  )

  return { title: value.title, slides }
}

export const slideOutputJsonSchema = {
  type: "object",
  properties: slideProperties,
  required: ["hook", "body", "layoutId"],
  additionalProperties: false,
} as const

export const hooksOutputJsonSchema = {
  type: "object",
  properties: Object.fromEntries(
    hookKeys.map((key) => [
      key,
      {
        type: "string",
        description:
          "A single standalone opening hook for slide 1, under 120 characters.",
      },
    ])
  ),
  required: hookKeys,
  additionalProperties: false,
} as const

export function normalizeGeneratedHooks(value: unknown): unknown {
  if (!isRecord(value)) return value
  return { hooks: hookKeys.map((key) => value[key]) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function limitText(value: string, maximum: number, addEllipsis = true) {
  if (value.length <= maximum) return value

  const ending = addEllipsis ? "…" : ""
  return `${value.slice(0, maximum - ending.length).trimEnd()}${ending}`
}
