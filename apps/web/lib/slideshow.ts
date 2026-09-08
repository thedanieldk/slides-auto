export type ThemeId = "paper" | "signal" | "midnight"
export type TextLayerRole = "hook" | "body" | "custom"
export type TextAlignment = "left" | "center" | "right"
export type TextFontFamily = "sans" | "serif" | "mono"

export type SlideImage = {
  id: string
  name: string
  dataUrl: string
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
  color: LayerColor
  backgroundColor: string | null
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
  image: SlideImage | null
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

type LegacySlide = {
  id: string
  headline: string
  body: string
  image: SlideImage | null
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

function makeId() {
  return crypto.randomUUID()
}

function createTextLayer(
  id: string,
  role: "hook" | "body",
  text: string
): TextLayer {
  const isHook = role === "hook"

  return {
    id,
    type: "text",
    role,
    name: isHook ? "Hook" : "Body",
    text,
    rect: isHook
      ? { x: 9, y: 58, width: 82, height: 21 }
      : { x: 9, y: 81, width: 76, height: 11 },
    style: structuredClone(isHook ? hookStyle : bodyStyle),
    visible: true,
    locked: false,
  }
}

function createTextLayers(
  slideId: string,
  headline: string,
  body: string
): TextLayer[] {
  return [
    createTextLayer(`${slideId}-hook`, "hook", headline),
    createTextLayer(`${slideId}-body`, "body", body),
  ]
}

function createStarterSlide(
  id: string,
  headline: string,
  body: string
): SlideshowSlide {
  return { id, image: null, textLayers: createTextLayers(id, headline, body) }
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

export function createSlide(index: number): SlideshowSlide {
  const id = makeId()
  return {
    id,
    image: null,
    textLayers: createTextLayers(
      id,
      `Slide ${index}`,
      "Add one clear thought for this frame."
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
  if (isProjectV2(value)) return value
  if (!isLegacyProject(value)) return null

  return {
    ...value,
    version: 2,
    slides: value.slides.map((slide) => ({
      id: slide.id,
      image: slide.image,
      textLayers: createTextLayers(slide.id, slide.headline, slide.body),
    })),
    updatedAt: new Date().toISOString(),
  }
}

function isProjectV2(value: unknown): value is SlideshowProject {
  if (!isProjectBase(value) || value.version !== 2) return false

  return value.slides.every(
    (slide) =>
      isRecord(slide) &&
      typeof slide.id === "string" &&
      Array.isArray(slide.textLayers) &&
      slide.textLayers.every(isTextLayer)
  )
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
