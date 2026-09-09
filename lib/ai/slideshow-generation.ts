import { z } from "zod"

import { copyFormatIds } from "@/lib/ai/copy-formats"
import { productProfileDraftSchema } from "@/lib/products/product-profile"

export const generatedSlideSchema = z.object({
  hook: z.string().trim().min(1).max(120),
  body: z.string().trim().max(180),
  imageQuery: z.string().trim().min(1).max(100),
  layoutId: z.enum(["editorial", "centered", "caption-card"]),
})

export const generatedSlideshowSchema = z.object({
  title: z.string().trim().min(1).max(80),
  slides: z.array(generatedSlideSchema).min(2).max(10),
})

export const slideshowGenerationRequestSchema = z.object({
  mode: z.literal("slideshow"),
  prompt: z.string().trim().min(12).max(2000),
  slideCount: z.number().int().min(2).max(10),
  layoutId: z.enum(["editorial", "centered", "caption-card"]),
  copyFormatId: z.enum(copyFormatIds),
  product: productProfileDraftSchema.nullable(),
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
  layoutId: z.enum(["editorial", "centered", "caption-card"]),
})

export const generationRequestSchema = z.discriminatedUnion("mode", [
  slideshowGenerationRequestSchema,
  slideRewriteRequestSchema,
])

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
    description: "Two to six concrete visual search terms.",
  },
  layoutId: {
    type: "string",
    enum: ["editorial", "centered", "caption-card"],
  },
} as const

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
