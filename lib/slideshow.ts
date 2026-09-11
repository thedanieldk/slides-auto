export type ThemeId = "paper" | "signal" | "midnight"
export const textStyleIds = [
  "clean-white",
  "soft-yellow",
  "yellow-cover",
  "label-body",
] as const
export type TextStyleId = (typeof textStyleIds)[number]
export const legacySlideLayoutIds = [
  "editorial",
  "centered",
  "caption-card",
] as const
export const internalSlideLayoutIds = ["yellow-continuation"] as const
export const slideLayoutIds = [
  ...textStyleIds,
  ...internalSlideLayoutIds,
  ...legacySlideLayoutIds,
] as const
export type SlideLayoutId = (typeof slideLayoutIds)[number]
export type TextLayerRole = "hook" | "body" | "custom"
export type TextAlignment = "left" | "center" | "right"
export type TextFontFamily =
  "sans" | "casual" | "handwritten" | "serif" | "mono"

export type SlideImage = {
  id: string
  name: string
  dataUrl: string
  source?: {
    provider: "pexels"
    photographer: string
    photographerUrl: string
    photoUrl: string
  }
}

export type LayerRect = {
  /** Horizontal position as a percentage of the slide width. */
  x: number
  /** Vertical position as a percentage of the slide height. */
  y: number
  /** Width as a percentage of the slide width. */
  width: number
  /** Height as a percentage of the slide height. */
  height: number
}

export type LayerColor =
  | { type: "theme"; token: "foreground" | "muted" }
  | { type: "custom"; value: string }

export type TextLayerStyle = {
  fontFamily: TextFontFamily
  /** Font size as a percentage of the slide width. */
  fontSize: number
  fontWeight: 400 | 500 | 600 | 700
  lineHeight: number
  letterSpacing: number
  align: TextAlignment
  textTransform?: "none" | "uppercase"
  color: LayerColor
  backgroundColor: string | null
  /** Whether the background fills the layer or hugs each line of text. */
  backgroundMode?: "block" | "line"
  /** Background opacity from 0 to 1. */
  backgroundOpacity?: number
  /** Inner spacing as a percentage of the slide width. */
  padding?: number
  /** Corner radius as a percentage of the slide width. */
  borderRadius?: number
  shadow: {
    color: string
    x: number
    y: number
    blur: number
  } | null
}

export type TextLayer = {
  id: string
  type: "text"
  role: TextLayerRole
  name: string
  text: string
  rect: LayerRect
  style: TextLayerStyle
  visible: boolean
  locked: boolean
}

export type SlideshowSlide = {
  id: string
  layoutId: SlideLayoutId
  image: SlideImage | null
  /** Suggested search phrase for a future image-source integration. */
  imageQuery: string | null
  textLayers: TextLayer[]
}

export type SlideshowProject = {
  version: 2
  id: string
  title: string
  themeId: ThemeId
  activeSlideId: string
  slides: SlideshowSlide[]
  updatedAt: string
}

export type SlideshowTheme = {
  id: ThemeId
  name: string
  description: string
  background: string
  preview: string
  foreground: string
  muted: string
  wash: string
}

export type SlideLayout = {
  id: SlideLayoutId
  name: string
  description: string
}

type LegacySlide = {
  id: string
  headline: string
  body: string
  image: SlideImage | null
}

type LayerPreset = {
  rect: LayerRect
  style: Partial<TextLayerStyle>
}

type LegacyProject = {
  version: 1
  id: string
  title: string
  themeId: ThemeId
  activeSlideId: string
  slides: LegacySlide[]
  updatedAt: string
}

type StoredSlideV2 = Omit<SlideshowSlide, "layoutId" | "imageQuery"> & {
  layoutId?: SlideLayoutId
  imageQuery?: string | null
}

type StoredProjectV2 = Omit<SlideshowProject, "slides"> & {
  slides: StoredSlideV2[]
}

export const slideshowThemes = [
  {
    id: "paper",
    name: "Paper story",
    description: "Soft, editorial, and reflective",
    background:
      "linear-gradient(155deg, #f5f0e7 0%, #e8dfd0 52%, #c8bbaa 100%)",
    preview: "linear-gradient(145deg, #f7f2e9, #c8bbaa)",
    foreground: "#24231f",
    muted: "#625f56",
    wash: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(23,22,19,.16))",
  },
  {
    id: "signal",
    name: "Signal pop",
    description: "Clear, energetic, and direct",
    background:
      "linear-gradient(145deg, #ff826b 0%, #f25267 42%, #6f55c7 100%)",
    preview: "linear-gradient(145deg, #ff826b, #6f55c7)",
    foreground: "#fffaf6",
    muted: "rgba(255,250,246,.78)",
    wash: "linear-gradient(180deg, rgba(55,20,52,.04), rgba(30,15,45,.28))",
  },
  {
    id: "midnight",
    name: "Blue hour",
    description: "Cinematic, calm, and precise",
    background:
      "radial-gradient(circle at 28% 18%, #5573ad 0%, #27395f 42%, #121a2b 100%)",
    preview: "linear-gradient(145deg, #5573ad, #121a2b)",
    foreground: "#f5f7ff",
    muted: "rgba(235,240,255,.7)",
    wash: "linear-gradient(180deg, rgba(9,14,28,.06), rgba(4,8,18,.4))",
  },
] as const satisfies readonly SlideshowTheme[]

const hookStyle: TextLayerStyle = {
  fontFamily: "sans",
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.02,
  letterSpacing: -0.055,
  align: "left",
  color: { type: "theme", token: "foreground" },
  backgroundColor: null,
  shadow: null,
}

const bodyStyle: TextLayerStyle = {
  fontFamily: "sans",
  fontSize: 3.8,
  fontWeight: 400,
  lineHeight: 1.6,
  letterSpacing: 0,
  align: "left",
  color: { type: "theme", token: "muted" },
  backgroundColor: null,
  shadow: null,
}

export const textStyles = [
  {
    id: "clean-white",
    name: "Clean white",
    description: "Large white type centered over the image",
  },
  {
    id: "soft-yellow",
    name: "Soft yellow",
    description: "Smaller warm text with an easy left edge",
  },
  {
    id: "yellow-cover",
    name: "Yellow cover",
    description: "Big yellow opener, then subtle white slides",
  },
  {
    id: "label-body",
    name: "Label + body",
    description: "White headline label with open body copy",
  },
] as const satisfies readonly (SlideLayout & { id: TextStyleId })[]

export function resolveCarouselTextStyle(
  textStyleId: TextStyleId,
  slideIndex: number
): SlideLayoutId {
  return textStyleId === "yellow-cover" && slideIndex > 0
    ? "yellow-continuation"
    : textStyleId
}

const legacySlideLayouts = [
  {
    id: "editorial",
    name: "Editorial stack",
    description: "Strong hook with supporting copy below",
  },
  {
    id: "centered",
    name: "Centered statement",
    description: "Balanced, spacious, and direct",
  },
  {
    id: "caption-card",
    name: "Caption card",
    description: "Readable text card over photography",
  },
] as const satisfies readonly SlideLayout[]

export const slideLayouts = [...textStyles, ...legacySlideLayouts] as const

const layoutPresets: Record<
  SlideLayoutId,
  { hook: LayerPreset; body: LayerPreset }
> = {
  "clean-white": {
    hook: {
      rect: { x: 10, y: 20, width: 80, height: 25 },
      style: {
        fontSize: 7.8,
        fontWeight: 500,
        lineHeight: 1.14,
        letterSpacing: -0.035,
        align: "center",
        color: { type: "custom", value: "#ffffff" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.42)", x: 0, y: 1, blur: 4 },
      },
    },
    body: {
      rect: { x: 12, y: 49, width: 76, height: 28 },
      style: {
        fontSize: 5.1,
        fontWeight: 400,
        lineHeight: 1.34,
        align: "center",
        color: { type: "custom", value: "#ffffff" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.42)", x: 0, y: 1, blur: 4 },
      },
    },
  },
  "soft-yellow": {
    hook: {
      rect: { x: 7, y: 22, width: 62, height: 15 },
      style: {
        fontSize: 5.5,
        fontWeight: 500,
        lineHeight: 1.18,
        letterSpacing: -0.025,
        align: "left",
        color: { type: "custom", value: "#fff58f" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.38)", x: 0, y: 1, blur: 3 },
      },
    },
    body: {
      rect: { x: 7, y: 39, width: 64, height: 34 },
      style: {
        fontSize: 4.6,
        fontWeight: 400,
        lineHeight: 1.34,
        align: "left",
        color: { type: "custom", value: "#fff58f" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.38)", x: 0, y: 1, blur: 3 },
      },
    },
  },
  "yellow-cover": {
    hook: {
      rect: { x: 7, y: 30, width: 86, height: 38 },
      style: {
        fontFamily: "casual",
        fontSize: 11.8,
        fontWeight: 700,
        lineHeight: 0.9,
        letterSpacing: -0.055,
        align: "center",
        textTransform: "uppercase",
        color: { type: "custom", value: "#fff58f" },
        backgroundColor: null,
        shadow: { color: "rgba(43,28,9,.3)", x: 0, y: 1, blur: 3 },
      },
    },
    body: {
      rect: { x: 12, y: 70, width: 76, height: 13 },
      style: {
        fontFamily: "handwritten",
        fontSize: 5.8,
        fontWeight: 400,
        lineHeight: 1.14,
        letterSpacing: 0.015,
        align: "center",
        textTransform: "none",
        color: { type: "custom", value: "#fffdf2" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.4)", x: 0, y: 1, blur: 3 },
      },
    },
  },
  "yellow-continuation": {
    hook: {
      rect: { x: 7, y: 22, width: 62, height: 15 },
      style: {
        fontSize: 5.5,
        fontWeight: 500,
        lineHeight: 1.18,
        letterSpacing: -0.025,
        align: "left",
        color: { type: "custom", value: "#fff58f" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.38)", x: 0, y: 1, blur: 3 },
      },
    },
    body: {
      rect: { x: 7, y: 39, width: 64, height: 34 },
      style: {
        fontSize: 4.6,
        fontWeight: 400,
        lineHeight: 1.34,
        align: "left",
        color: { type: "custom", value: "#fff58f" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.38)", x: 0, y: 1, blur: 3 },
      },
    },
  },
  "label-body": {
    hook: {
      rect: { x: 12, y: 18, width: 76, height: 18 },
      style: {
        fontFamily: "casual",
        fontSize: 5.4,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: -0.015,
        align: "center",
        color: { type: "custom", value: "#101114" },
        backgroundColor: "rgba(255,255,255,.96)",
        backgroundMode: "line",
        padding: 1.2,
        borderRadius: 1.4,
        shadow: null,
      },
    },
    body: {
      rect: { x: 13, y: 39, width: 74, height: 34 },
      style: {
        fontFamily: "casual",
        fontSize: 5.15,
        fontWeight: 400,
        lineHeight: 1.32,
        letterSpacing: -0.012,
        align: "center",
        color: { type: "custom", value: "#ffffff" },
        backgroundColor: null,
        shadow: { color: "rgba(0,0,0,.45)", x: 0, y: 1, blur: 4 },
      },
    },
  },
  editorial: {
    hook: {
      rect: { x: 9, y: 58, width: 82, height: 21 },
      style: {},
    },
    body: {
      rect: { x: 9, y: 81, width: 76, height: 11 },
      style: {},
    },
  },
  centered: {
    hook: {
      rect: { x: 10, y: 33, width: 80, height: 28 },
      style: {
        fontSize: 9.2,
        lineHeight: 1.06,
        letterSpacing: -0.045,
        align: "center",
      },
    },
    body: {
      rect: { x: 18, y: 64, width: 64, height: 14 },
      style: { fontSize: 3.6, lineHeight: 1.55, align: "center" },
    },
  },
  "caption-card": {
    hook: {
      rect: { x: 6, y: 62, width: 88, height: 19 },
      style: {
        fontSize: 7.4,
        lineHeight: 1.1,
        letterSpacing: -0.035,
        color: { type: "custom", value: "#20212a" },
        backgroundColor: "rgba(255, 252, 247, 0.92)",
        padding: 3,
        borderRadius: 3,
      },
    },
    body: {
      rect: { x: 9, y: 84, width: 76, height: 9 },
      style: { fontSize: 3.4, lineHeight: 1.45 },
    },
  },
}

function makeId() {
  return crypto.randomUUID()
}

function createTextLayer(
  id: string,
  role: "hook" | "body",
  text: string,
  layoutId: SlideLayoutId
): TextLayer {
  const isHook = role === "hook"
  const preset = layoutPresets[layoutId][role]
  const baseStyle = isHook ? hookStyle : bodyStyle

  return {
    id,
    type: "text",
    role,
    name: isHook ? "Hook" : "Body",
    text,
    rect: structuredClone(preset.rect),
    style: { ...structuredClone(baseStyle), ...structuredClone(preset.style) },
    visible: true,
    locked: false,
  }
}

function createTextLayers(
  slideId: string,
  headline: string,
  body: string,
  layoutId: SlideLayoutId = "clean-white"
): TextLayer[] {
  return [
    createTextLayer(`${slideId}-hook`, "hook", headline, layoutId),
    createTextLayer(`${slideId}-body`, "body", body, layoutId),
  ]
}

function createStarterSlide(
  id: string,
  headline: string,
  body: string
): SlideshowSlide {
  return {
    id,
    layoutId: "clean-white",
    image: null,
    imageQuery: null,
    textLayers: createTextLayers(id, headline, body),
  }
}

const starterSlides: SlideshowSlide[] = [
  createStarterSlide(
    "starter-01",
    "A small idea can carry a whole story.",
    "Start with the moment that makes someone stop scrolling."
  ),
  createStarterSlide(
    "starter-02",
    "Build the tension one frame at a time.",
    "Keep each thought focused enough to read in a second."
  ),
  createStarterSlide(
    "starter-03",
    "Leave them with something worth saving.",
    "The last slide should make the next action feel obvious."
  ),
]

export const starterProject: SlideshowProject = {
  version: 2,
  id: "starter-project",
  title: "Untitled slideshow",
  themeId: "paper",
  activeSlideId: starterSlides[0]!.id,
  slides: starterSlides,
  updatedAt: "2026-09-08T00:00:00.000Z",
}

export function createSlide(
  index: number,
  layoutId: SlideLayoutId = "clean-white"
): SlideshowSlide {
  const id = makeId()
  return {
    id,
    layoutId,
    image: null,
    imageQuery: null,
    textLayers: createTextLayers(
      id,
      `Slide ${index}`,
      "Add one clear thought for this frame.",
      layoutId
    ),
  }
}

export function createProject(): SlideshowProject {
  const firstSlide = createSlide(1)

  return {
    version: 2,
    id: makeId(),
    title: "Untitled slideshow",
    themeId: "paper",
    activeSlideId: firstSlide.id,
    slides: [firstSlide],
    updatedAt: new Date().toISOString(),
  }
}

export function getTextLayer(slide: SlideshowSlide, role: "hook" | "body") {
  return slide.textLayers.find((layer) => layer.role === role)
}

export function applySlideLayout(
  slide: SlideshowSlide,
  layoutId: SlideLayoutId
): SlideshowSlide {
  return {
    ...slide,
    layoutId,
    textLayers: slide.textLayers.map((layer) => {
      if (layer.role !== "hook" && layer.role !== "body") return layer
      const preset = layoutPresets[layoutId][layer.role]
      const baseStyle = layer.role === "hook" ? hookStyle : bodyStyle

      return {
        ...layer,
        rect: structuredClone(preset.rect),
        style: {
          ...structuredClone(baseStyle),
          ...structuredClone(preset.style),
        },
      }
    }),
  }
}

export function resolveLayerColor(color: LayerColor, theme: SlideshowTheme) {
  if (color.type === "custom") return color.value
  return theme[color.token]
}

export function getTextShadow(style: TextLayerStyle) {
  if (!style.shadow) return undefined
  const { x, y, blur, color } = style.shadow
  return `${x}px ${y}px ${blur}px ${color}`
}

export function loadSlideshowProject(value: unknown): SlideshowProject | null {
  if (isProjectV2(value)) {
    return {
      ...value,
      slides: value.slides.map((slide) => {
        const normalizedSlide = {
          ...slide,
          layoutId: slide.layoutId ?? "clean-white",
          imageQuery: slide.imageQuery ?? null,
        }

        return normalizedSlide.layoutId === "label-body"
          ? applySlideLayout(normalizedSlide, "label-body")
          : normalizedSlide
      }),
    }
  }
  if (!isLegacyProject(value)) return null

  return {
    ...value,
    version: 2,
    slides: value.slides.map((slide) => ({
      id: slide.id,
      layoutId: "clean-white",
      image: slide.image,
      imageQuery: null,
      textLayers: createTextLayers(slide.id, slide.headline, slide.body),
    })),
    updatedAt: new Date().toISOString(),
  }
}

function isProjectV2(value: unknown): value is StoredProjectV2 {
  if (!isProjectBase(value) || value.version !== 2) return false

  return value.slides.every(
    (slide) =>
      isRecord(slide) &&
      typeof slide.id === "string" &&
      (slide.layoutId === undefined || isSlideLayoutId(slide.layoutId)) &&
      Array.isArray(slide.textLayers) &&
      slide.textLayers.every(isTextLayer)
  )
}

function isSlideLayoutId(value: unknown): value is SlideLayoutId {
  return slideLayoutIds.some((layoutId) => layoutId === value)
}

function isLegacyProject(value: unknown): value is LegacyProject {
  if (!isProjectBase(value) || value.version !== 1) return false

  return value.slides.every(
    (slide) =>
      isRecord(slide) &&
      typeof slide.id === "string" &&
      typeof slide.headline === "string" &&
      typeof slide.body === "string"
  )
}

function isProjectBase(value: unknown): value is Record<string, unknown> & {
  slides: unknown[]
  themeId: ThemeId
} {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.activeSlideId === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.slides) &&
    value.slides.length > 0 &&
    slideshowThemes.some((theme) => theme.id === value.themeId)
  )
}

function isTextLayer(value: unknown): value is TextLayer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.type === "text" &&
    (value.role === "hook" ||
      value.role === "body" ||
      value.role === "custom") &&
    typeof value.text === "string" &&
    isRecord(value.rect) &&
    isRecord(value.style)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}
