import {
  applySlideLayout,
  createSlide,
  getTextLayer,
  resolveCarouselTextStyle,
  type SlideshowSlide,
  type TextLayer,
  type TextStyleId,
} from "@/lib/slideshow"
import type {
  GeneratedSlide,
  GeneratedSlideshow,
} from "@/lib/ai/slideshow-generation"
import { DEFAULT_IMAGE_QUERY } from "@/lib/images/image-provider"

export type CompositionOptions = {
  script: string
  layoutId: TextStyleId
}

export type CompositionResult = {
  title: string
  slides: SlideshowSlide[]
}

export function composeScript({
  script,
  layoutId,
}: CompositionOptions): CompositionResult {
  const cleanScript = script.replace(/\r/g, "").trim()
  const pieces = preparePieces(cleanScript)

  const slides = pieces.map((piece, index) => {
    const slide = createSlide(
      index + 1,
      resolveCarouselTextStyle(layoutId, index)
    )
    const { hook, body } = createSlideCopy(piece)
    const textLayers = slide.textLayers.map((layer) => {
      if (layer.role === "hook") return fitTextLayer({ ...layer, text: hook })
      if (layer.role === "body") return fitTextLayer({ ...layer, text: body })
      return layer
    })

    return {
      ...slide,
      imageQuery: DEFAULT_IMAGE_QUERY,
      textLayers,
    }
  })

  const firstHook = slides[0] ? getTextLayer(slides[0], "hook")?.text : null
  return {
    title: firstHook ? makeTitle(firstHook) : "Composed slideshow",
    slides,
  }
}

export function composeGeneratedSlideshow(
  generated: GeneratedSlideshow
): CompositionResult {
  return {
    title: generated.title,
    slides: generated.slides.map((generatedSlide, index) =>
      applyGeneratedCopy(
        createSlide(index + 1, generatedSlide.layoutId),
        generatedSlide
      )
    ),
  }
}

export function applyGeneratedCopy(
  slide: SlideshowSlide,
  generated: GeneratedSlide
): SlideshowSlide {
  const slideWithLayout =
    slide.layoutId === generated.layoutId
      ? slide
      : applySlideLayout(slide, generated.layoutId)

  return {
    ...slideWithLayout,
    id: slide.id,
    image: slide.image,
    imageQuery: generated.imageQuery,
    textLayers: slideWithLayout.textLayers.map((layer) => {
      if (layer.role === "hook") {
        return fitTextLayer({ ...layer, text: generated.hook })
      }
      if (layer.role === "body") {
        return fitTextLayer({ ...layer, text: generated.body })
      }
      return layer
    }),
  }
}

export function hasTextOverflowRisk(slide: SlideshowSlide) {
  const hook = getTextLayer(slide, "hook")
  const body = getTextLayer(slide, "body")
  return Boolean(
    (hook && hook.text.length > 150) || (body && body.text.length > 240)
  )
}

function preparePieces(script: string) {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map(cleanPiece)
    .filter(Boolean)

  let pieces = paragraphs.flatMap((paragraph) => {
    const lines = paragraph.split("\n").map(cleanPiece).filter(Boolean)
    if (lines.length > 1) return lines
    if (paragraph.length < 150) return [paragraph]
    return splitSentences(paragraph)
  })

  if (pieces.length === 1) pieces = splitSentences(pieces[0]!)

  return pieces.length > 0 ? pieces : ["Untitled slideshow"]
}

function createSlideCopy(piece: string) {
  const words = piece.split(/\s+/)
  if (words.length <= 13) return { hook: piece, body: "" }

  const breakpoint = Math.min(12, Math.ceil(words.length * 0.38))
  return {
    hook: words.slice(0, breakpoint).join(" "),
    body: words.slice(breakpoint).join(" "),
  }
}

export function fitTextLayer(layer: TextLayer): TextLayer {
  const length = layer.text.length
  const multiplier =
    layer.role === "hook"
      ? length <= 48
        ? 1
        : length <= 85
          ? 0.86
          : length <= 125
            ? 0.72
            : 0.62
      : length <= 100
        ? 1
        : length <= 175
          ? 0.84
          : 0.7
  const minimum = layer.role === "hook" ? 4.8 : 2.45

  return {
    ...layer,
    style: {
      ...layer.style,
      fontSize: Math.max(minimum, layer.style.fontSize * multiplier),
    },
  }
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map(cleanPiece)
    .filter(Boolean)
}

function cleanPiece(value: string) {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
}

function makeTitle(value: string) {
  const clean = value.replace(/[.!?]+$/, "").trim()
  return clean.length <= 54 ? clean : `${clean.slice(0, 51).trimEnd()}…`
}
