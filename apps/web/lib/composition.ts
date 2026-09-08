import {
  createSlide,
  getTextLayer,
  type SlideLayoutId,
  type SlideshowSlide,
  type TextLayer,
} from "@/lib/slideshow"

export type CompositionOptions = {
  script: string
  slideCount: number
  layoutId: SlideLayoutId
}

export type CompositionResult = {
  title: string
  slides: SlideshowSlide[]
}

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "from",
  "have",
  "into",
  "just",
  "more",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
])

export function composeScript({
  script,
  slideCount,
  layoutId,
}: CompositionOptions): CompositionResult {
  const cleanScript = script.replace(/\r/g, "").trim()
  const requestedCount = Math.max(2, Math.min(10, Math.round(slideCount)))
  const pieces = preparePieces(cleanScript, requestedCount)
  const groups = groupPieces(pieces, Math.min(requestedCount, pieces.length))

  const slides = groups.map((group, index) => {
    const slide = createSlide(index + 1, layoutId)
    const { hook, body } = createSlideCopy(group)
    const textLayers = slide.textLayers.map((layer) => {
      if (layer.role === "hook") return fitLayer({ ...layer, text: hook })
      if (layer.role === "body") return fitLayer({ ...layer, text: body })
      return layer
    })

    return {
      ...slide,
      imageQuery: createImageQuery(`${hook} ${body}`),
      textLayers,
    }
  })

  const firstHook = slides[0] ? getTextLayer(slides[0], "hook")?.text : null
  return {
    title: firstHook ? makeTitle(firstHook) : "Composed slideshow",
    slides,
  }
}

export function hasTextOverflowRisk(slide: SlideshowSlide) {
  const hook = getTextLayer(slide, "hook")
  const body = getTextLayer(slide, "body")
  return Boolean(
    (hook && hook.text.length > 150) || (body && body.text.length > 240)
  )
}

function preparePieces(script: string, desiredCount: number) {
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

  while (pieces.length < desiredCount) {
    const longestIndex = pieces.reduce(
      (bestIndex, piece, index) =>
        piece.split(/\s+/).length > pieces[bestIndex]!.split(/\s+/).length
          ? index
          : bestIndex,
      0
    )
    const longest = pieces[longestIndex]!
    const words = longest.split(/\s+/)
    if (words.length < 8) break

    const midpoint = Math.ceil(words.length / 2)
    pieces.splice(
      longestIndex,
      1,
      words.slice(0, midpoint).join(" "),
      words.slice(midpoint).join(" ")
    )
  }

  return pieces.length > 0 ? pieces : ["Untitled slideshow"]
}

function groupPieces(pieces: string[], count: number) {
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * pieces.length) / count)
    const end = Math.floor(((index + 1) * pieces.length) / count)
    return pieces.slice(start, Math.max(start + 1, end))
  })
}

function createSlideCopy(group: string[]) {
  const [first = "Untitled slide", ...rest] = group
  if (rest.length > 0) return { hook: first, body: rest.join(" ") }

  const words = first.split(/\s+/)
  if (words.length <= 13) return { hook: first, body: "" }

  const breakpoint = Math.min(12, Math.ceil(words.length * 0.38))
  return {
    hook: words.slice(0, breakpoint).join(" "),
    body: words.slice(breakpoint).join(" "),
  }
}

function fitLayer(layer: TextLayer): TextLayer {
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

function createImageQuery(value: string) {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))

  return [...new Set(words)].slice(0, 4).join(" ") || "editorial texture"
}

function makeTitle(value: string) {
  const clean = value.replace(/[.!?]+$/, "").trim()
  return clean.length <= 54 ? clean : `${clean.slice(0, 51).trimEnd()}…`
}
