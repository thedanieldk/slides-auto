"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  ImagePlus,
  Images,
  Layers3,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toBlob } from "html-to-image"
import JSZip from "jszip"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CompositionDialog } from "@/components/composition-dialog"
import { ImageSearchDialog } from "@/components/image-search-dialog"
import { applyGeneratedCopy, type CompositionResult } from "@/lib/composition"
import { generatedSlideSchema } from "@/lib/ai/slideshow-generation"
import { searchImages } from "@/lib/images/search-images"
import {
  DEFAULT_IMAGE_QUERY,
  type ImageSearchResult,
} from "@/lib/images/image-provider"
import {
  applySlideLayout,
  createProject,
  createSlide,
  getTextLayer,
  getTextShadow,
  loadSlideshowProject,
  resolveLayerColor,
  resolveCarouselTextStyle,
  slideshowThemes,
  starterProject,
  textStyles,
  type SlideImage,
  type SlideshowProject,
  type SlideshowSlide,
  type SlideshowTheme,
  type TextFontFamily,
  type TextLayer,
  type TextLayerStyle,
  type TextStyleId,
} from "@/lib/slideshow"

const STORAGE_KEY = "slides-auto.phase-one-project"

const FONT_OPTIONS = [
  {
    id: "sans",
    name: "Geist",
    sample: "Clean",
    stack: "var(--font-sans)",
  },
  {
    id: "casual",
    name: "Casual",
    sample: "Everyday",
    stack: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  },
  {
    id: "handwritten",
    name: "Handwritten",
    sample: "Personal",
    stack: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive",
  },
  {
    id: "serif",
    name: "Georgia",
    sample: "Editorial",
    stack: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "mono",
    name: "Geist Mono",
    sample: "Notes",
    stack: "var(--font-mono)",
  },
] as const satisfies readonly {
  id: TextFontFamily
  name: string
  sample: string
  stack: string
}[]

type LayerInteraction = {
  layerId: string
  mode: "drag" | "resize"
  pointerId: number
  startX: number
  startY: number
  startRect: TextLayer["rect"]
  moved: boolean
}

function cloneStarterProject() {
  return structuredClone(starterProject)
}

export function SlideshowStudio() {
  const [project, setProject] = useState<SlideshowProject>(cloneStarterProject)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">(
    "saved"
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [imageSearchOpen, setImageSearchOpen] = useState(false)
  const [isAutoFillingImages, setIsAutoFillingImages] = useState(false)
  const [isExportingZip, setIsExportingZip] = useState(false)
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(
    null
  )
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const slideCanvasRef = useRef<HTMLDivElement>(null)
  const inlineEditorRef = useRef<HTMLSpanElement>(null)
  const layerInteractionRef = useRef<LayerInteraction | null>(null)
  const lastTapRef = useRef<{ layerId: string; timestamp: number } | null>(null)

  useEffect(() => {
    const storedProject = window.localStorage.getItem(STORAGE_KEY)
    const loadProject = window.setTimeout(() => {
      if (storedProject) {
        try {
          const parsedProject: unknown = JSON.parse(storedProject)
          const loadedProject = loadSlideshowProject(parsedProject)
          if (loadedProject) setProject(loadedProject)
        } catch {
          setNotice(
            "The saved project could not be opened. A starter is loaded."
          )
        }
      }

      setHasLoaded(true)
    }, 0)

    return () => window.clearTimeout(loadProject)
  }, [])

  useEffect(() => {
    if (!hasLoaded) return

    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
        setSaveState("saved")
      } catch {
        setSaveState("failed")
        setNotice(
          "Local storage is full. Remove large images before continuing."
        )
      }
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [hasLoaded, project])

  useEffect(() => {
    const editor = inlineEditorRef.current
    if (!editingLayerId || !editor) return

    editor.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editor)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [editingLayerId])

  const activeSlide = useMemo(
    () =>
      project.slides.find((slide) => slide.id === project.activeSlideId) ??
      project.slides[0]!,
    [project]
  )
  const activeIndex = project.slides.findIndex(
    (slide) => slide.id === activeSlide.id
  )
  const activeTheme =
    slideshowThemes.find((theme) => theme.id === project.themeId) ??
    slideshowThemes[0]
  const hookLayer = getTextLayer(activeSlide, "hook")
  const bodyLayer = getTextLayer(activeSlide, "body")
  const selectedLayer =
    activeSlide.textLayers.find((layer) => layer.id === selectedLayerId) ??
    hookLayer ??
    bodyLayer
  const selectedFont = selectedLayer
    ? (FONT_OPTIONS.find(
        (font) => font.id === selectedLayer.style.fontFamily
      ) ?? FONT_OPTIONS[0])
    : null
  const selectedBackgroundMode = !selectedLayer?.style.backgroundColor
    ? "none"
    : selectedLayer.style.backgroundMode === "line"
      ? "line"
      : "block"
  const appliedTextStyle = getAppliedTextStyle(project.slides)

  function isTextStyleActive(textStyleId: TextStyleId) {
    return appliedTextStyle === textStyleId
  }

  function updateProject(
    updater: (current: SlideshowProject) => SlideshowProject
  ) {
    setSaveState("saving")
    setProject((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateActiveSlide(changes: Partial<SlideshowSlide>) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId ? { ...slide, ...changes } : slide
      ),
    }))
  }

  function updateTextLayer(layerId: string, changes: Partial<TextLayer>) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              textLayers: slide.textLayers.map((layer) =>
                layer.id === layerId ? { ...layer, ...changes } : layer
              ),
            }
          : slide
      ),
    }))
  }

  function updateSelectedLayerStyle(changes: Partial<TextLayer["style"]>) {
    if (!selectedLayer) return
    updateTextLayer(selectedLayer.id, {
      style: { ...selectedLayer.style, ...changes },
    })
  }

  function toggleLayerVisibility(layer: TextLayer) {
    updateTextLayer(layer.id, { visible: !layer.visible })
  }

  function selectBackgroundMode(mode: "none" | "line" | "block") {
    if (!selectedLayer) return

    updateSelectedLayerStyle(
      mode === "none"
        ? { backgroundColor: null }
        : {
            backgroundColor: getColorInputValue(
              selectedLayer.style.backgroundColor,
              "#ffffff"
            ),
            backgroundMode: mode,
            backgroundOpacity: getBackgroundOpacity(selectedLayer),
            padding: selectedLayer.style.padding ?? 1.2,
            borderRadius: selectedLayer.style.borderRadius ?? 1.4,
          }
    )
  }

  function startLayerInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: TextLayer,
    mode: LayerInteraction["mode"]
  ) {
    if (layer.locked || editingLayerId === layer.id) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedLayerId(layer.id)
    layerInteractionRef.current = {
      layerId: layer.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: structuredClone(layer.rect),
      moved: false,
    }
  }

  function moveLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = layerInteractionRef.current
    const canvas = slideCanvasRef.current
    if (!interaction || interaction.pointerId !== event.pointerId || !canvas) {
      return
    }

    const canvasRect = canvas.getBoundingClientRect()
    const deltaX =
      ((event.clientX - interaction.startX) / canvasRect.width) * 100
    const deltaY =
      ((event.clientY - interaction.startY) / canvasRect.height) * 100
    interaction.moved ||= Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5

    const start = interaction.startRect
    const rect =
      interaction.mode === "drag"
        ? {
            ...start,
            x: clamp(start.x + deltaX, 0, 100 - start.width),
            y: clamp(start.y + deltaY, 0, 100 - start.height),
          }
        : {
            ...start,
            width: clamp(start.width + deltaX, 15, 100 - start.x),
            height: clamp(start.height + deltaY, 8, 100 - start.y),
          }

    updateTextLayer(interaction.layerId, { rect })
  }

  function finishLayerInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: TextLayer
  ) {
    const interaction = layerInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    layerInteractionRef.current = null

    if (
      event.pointerType !== "touch" ||
      interaction.mode !== "drag" ||
      interaction.moved
    ) {
      return
    }

    const now = event.timeStamp
    const lastTap = lastTapRef.current
    if (lastTap?.layerId === layer.id && now - lastTap.timestamp < 350) {
      setEditingLayerId(layer.id)
      lastTapRef.current = null
      return
    }

    lastTapRef.current = { layerId: layer.id, timestamp: now }
  }

  function cancelLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = layerInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    layerInteractionRef.current = null
  }

  function startInlineEditing(layer: TextLayer) {
    if (layer.locked) return
    setSelectedLayerId(layer.id)
    setEditingLayerId(layer.id)
  }

  function finishInlineEditing(layer: TextLayer, text: string) {
    updateTextLayer(layer.id, { text: text.replace(/\n{3,}/g, "\n\n").trim() })
    setEditingLayerId(null)
  }

  function addSlide() {
    updateProject((current) => {
      const currentTextStyle = getAppliedTextStyle(current.slides)
      const nextSlide = createSlide(
        current.slides.length + 1,
        currentTextStyle
          ? resolveCarouselTextStyle(currentTextStyle, current.slides.length)
          : "clean-white"
      )
      return {
        ...current,
        slides: [...current.slides, nextSlide],
        activeSlideId: nextSlide.id,
      }
    })
  }

  function duplicateSlide(slideId: string) {
    updateProject((current) => {
      const index = current.slides.findIndex((slide) => slide.id === slideId)
      const source = current.slides[index]!
      const duplicate = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        textLayers: source.textLayers.map((layer) => ({
          ...structuredClone(layer),
          id: crypto.randomUUID(),
        })),
      }
      const slides = [...current.slides]
      slides.splice(index + 1, 0, duplicate)
      return { ...current, slides, activeSlideId: duplicate.id }
    })
  }

  function removeSlide(slideId: string) {
    if (project.slides.length === 1) return

    updateProject((current) => {
      const index = current.slides.findIndex((slide) => slide.id === slideId)
      const slides = current.slides.filter((slide) => slide.id !== slideId)
      const nextActiveSlide = slides[Math.min(index, slides.length - 1)]!
      return { ...current, slides, activeSlideId: nextActiveSlide.id }
    })
  }

  function moveSlide(slideId: string, direction: -1 | 1) {
    updateProject((current) => {
      const fromIndex = current.slides.findIndex(
        (slide) => slide.id === slideId
      )
      const toIndex = fromIndex + direction
      if (toIndex < 0 || toIndex >= current.slides.length) return current

      const slides = [...current.slides]
      const [movingSlide] = slides.splice(fromIndex, 1)
      if (!movingSlide) return current
      slides.splice(toIndex, 0, movingSlide)
      return { ...current, slides }
    })
  }

  function selectTextStyle(textStyleId: TextStyleId) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        applySlideLayout(slide, resolveCarouselTextStyle(textStyleId, index))
      ),
    }))
    setNotice(`Text style applied to all ${project.slides.length} slides.`)
  }

  function applyComposition(result: CompositionResult) {
    const shouldReplace = window.confirm(
      `Replace the current slideshow with ${result.slides.length} composed slides?`
    )
    if (!shouldReplace) return

    updateProject((current) => ({
      ...current,
      title:
        current.title === "Untitled slideshow" ? result.title : current.title,
      slides: result.slides,
      activeSlideId: result.slides[0]!.id,
    }))
    setComposerOpen(false)
    setNotice(`${result.slides.length} editable slides composed.`)
  }

  async function regenerateActiveSlide() {
    const slide = activeSlide
    const slideIndex = activeIndex
    const previousSlide = project.slides[slideIndex - 1]
    const nextSlide = project.slides[slideIndex + 1]

    setRegeneratingSlideId(slide.id)
    setNotice(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "slide",
          projectTitle: project.title,
          slideIndex,
          slideCount: project.slides.length,
          currentHook: getTextLayer(slide, "hook")?.text ?? "",
          currentBody: getTextLayer(slide, "body")?.text ?? "",
          previousHook: previousSlide
            ? (getTextLayer(previousSlide, "hook")?.text ?? null)
            : null,
          nextHook: nextSlide
            ? (getTextLayer(nextSlide, "hook")?.text ?? null)
            : null,
          layoutId: slide.layoutId,
        }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}

      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "The AI service could not rewrite this slide."
        )
      }

      const generated = generatedSlideSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("The generated slide copy was incomplete. Try again.")
      }

      updateProject((current) => ({
        ...current,
        slides: current.slides.map((currentSlide) =>
          currentSlide.id === slide.id
            ? applyGeneratedCopy(currentSlide, generated.data)
            : currentSlide
        ),
      }))
      setNotice(`Slide ${slideIndex + 1} rewritten.`)
    } catch (generationError) {
      setNotice(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while rewriting this slide."
      )
    } finally {
      setRegeneratingSlideId(null)
    }
  }

  function startNewProject() {
    const shouldReplace = window.confirm(
      "Start a new slideshow? This replaces the project saved in this browser."
    )
    if (!shouldReplace) return

    setProject(createProject())
    setNotice("New slideshow created.")
  }

  function restoreStarter() {
    const shouldReplace = window.confirm(
      "Restore the three-slide starter? Your current local project will be replaced."
    )
    if (!shouldReplace) return

    setProject(cloneStarterProject())
    setNotice("Starter slideshow restored.")
  }

  function handleImageUpload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file such as PNG, JPEG, or WebP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice("Choose an image smaller than 5 MB for browser-only storage.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      updateActiveSlide({
        image: {
          id: crypto.randomUUID(),
          name: file.name,
          dataUrl: reader.result,
        },
      })
      setNotice(`${file.name} added to slide ${activeIndex + 1}.`)
    }
    reader.readAsDataURL(file)
  }

  async function autoFillMissingImages() {
    const targets = project.slides.flatMap((slide) => {
      const query = getSlideImageQuery()
      return !slide.image && query.length >= 2 ? [{ slide, query }] : []
    })

    if (targets.length === 0) {
      setNotice("Every slide already has an image or needs an image query.")
      return
    }

    setIsAutoFillingImages(true)
    setNotice(null)
    try {
      const searches = await Promise.allSettled(
        targets.map(async ({ slide, query }) => ({
          slideId: slide.id,
          results: await searchImages(query),
        }))
      )
      const usedImageIds = new Set(
        project.slides.flatMap((slide) =>
          slide.image?.id.startsWith("pexels-") ? [slide.image.id] : []
        )
      )
      const selectedImages = new Map<string, SlideImage>()
      let failedSearches = 0

      for (const search of searches) {
        if (search.status === "rejected") {
          failedSearches += 1
          continue
        }

        const result =
          search.value.results.find(
            (candidate) => !usedImageIds.has(`pexels-${candidate.id}`)
          ) ?? search.value.results[0]
        if (!result) {
          failedSearches += 1
          continue
        }

        const image = toSlideImage(result)
        usedImageIds.add(image.id)
        selectedImages.set(search.value.slideId, image)
      }

      if (selectedImages.size > 0) {
        updateProject((current) => ({
          ...current,
          slides: current.slides.map((slide) => ({
            ...slide,
            image: selectedImages.get(slide.id) ?? slide.image,
          })),
        }))
      }

      setNotice(
        selectedImages.size === 0
          ? "No matching photos were found. Try changing a slide image query."
          : `${selectedImages.size} ${selectedImages.size === 1 ? "slide" : "slides"} filled${failedSearches ? `; ${failedSearches} could not be matched` : ""}.`
      )
    } finally {
      setIsAutoFillingImages(false)
    }
  }

  async function downloadSlidesAsZip() {
    setIsExportingZip(true)
    setNotice(null)
    try {
      await document.fonts.ready

      const zip = new JSZip()
      let exported = 0
      for (const [index, slide] of project.slides.entries()) {
        const blob = await renderSlideToBlob(slide, activeTheme)
        if (blob) {
          zip.file(`slide-${String(index + 1).padStart(2, "0")}.png`, blob)
          exported += 1
        }
      }

      if (exported === 0) {
        setNotice("Nothing could be exported. Try again.")
        return
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      downloadBlob(zipBlob, `${slugifyFilename(project.title)}.zip`)
      setNotice(
        `Downloaded ${exported} ${exported === 1 ? "slide" : "slides"} as a zip.`
      )
    } catch {
      setNotice("Could not create the download. Try again.")
    } finally {
      setIsExportingZip(false)
    }
  }

  return (
    <main className="min-h-svh bg-[#e9e7e2] text-[#1b1c24]">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-black/10 bg-[#f8f7f4]/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#4758c7] text-white shadow-[0_6px_18px_rgba(71,88,199,.22)]">
            <Layers3 className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-black/45">Slides Auto</p>
            <input
              aria-label="Project title"
              className="w-full min-w-0 truncate bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#4758c7]/35"
              value={project.title}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "hidden items-center gap-1.5 text-xs sm:flex",
              saveState === "failed" ? "text-red-700" : "text-black/45"
            )}
            role="status"
          >
            {saveState === "saved" && <Check className="size-3.5" />}
            {saveState === "saving" ? "Saving…" : null}
            {saveState === "saved" ? "Saved locally" : null}
            {saveState === "failed" ? "Not saved" : null}
          </div>
          <Button
            size="sm"
            aria-label="Compose slideshow"
            className="bg-[#4758c7] text-white hover:bg-[#3d4db8]"
            onClick={() => setComposerOpen(true)}
          >
            <Sparkles data-icon="inline-start" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isExportingZip}
            onClick={() => void downloadSlidesAsZip()}
          >
            {isExportingZip ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">
              {isExportingZip ? "Zipping…" : "Download"}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={restoreStarter}>
            <RotateCcw data-icon="inline-start" />
            <span className="hidden sm:inline">Starter</span>
          </Button>
          <Button size="sm" onClick={startNewProject}>
            <Plus data-icon="inline-start" />
            New
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#22242e] py-2 pr-2 pl-4 text-sm text-white shadow-xl"
            role="status"
          >
            <span>{notice}</span>
            <button
              type="button"
              className="rounded-full px-2 py-1 text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={() => setNotice(null)}
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-h-[calc(100svh-4rem)] lg:h-[calc(100svh-4rem)] lg:grid-cols-[14rem_minmax(0,1fr)_19rem] lg:overflow-hidden">
        <aside className="border-b border-black/10 bg-[#f3f1ed] p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Slides</h2>
            <span className="text-xs text-black/45 tabular-nums">
              {project.slides.length}
            </span>
          </div>

          <div className="lg:relative lg:min-h-0 lg:flex-1">
            <div className="flex gap-3 overflow-x-auto pb-2 lg:absolute lg:inset-0 lg:flex-col lg:overflow-y-auto lg:pr-1">
              <AnimatePresence initial={false}>
                {project.slides.map((slide, index) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    key={slide.id}
                    className="w-32 shrink-0 lg:w-full"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateProject((current) => ({
                          ...current,
                          activeSlideId: slide.id,
                        }))
                      }
                      className={cn(
                        "group relative w-full rounded-xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                        slide.id === project.activeSlideId
                          ? "border-[#4758c7] bg-white shadow-[0_8px_24px_rgba(42,43,55,.09)]"
                          : "border-black/10 bg-white/45 hover:bg-white/75"
                      )}
                    >
                      <span
                        className="relative block aspect-[9/12] overflow-hidden rounded-lg"
                        style={{
                          background: activeTheme.background,
                          containerType: "inline-size",
                        }}
                      >
                        {slide.image && (
                          <span
                            className="absolute inset-0 bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${JSON.stringify(slide.image.dataUrl)})`,
                            }}
                          />
                        )}
                        {slide.textLayers.map(
                          (layer) =>
                            layer.visible && (
                              <span
                                key={layer.id}
                                className="absolute z-10 overflow-hidden text-pretty"
                                style={getTextLayerStyle(layer, activeTheme)}
                              >
                                <span style={getTextLayerContentStyle(layer)}>
                                  {layer.text}
                                </span>
                              </span>
                            )
                        )}
                      </span>
                    </button>

                    <div className="mt-1 flex items-center justify-end gap-0.5 text-black/40">
                      <SlideAction
                        label="Move slide up"
                        disabled={index === 0}
                        onClick={() => moveSlide(slide.id, -1)}
                      >
                        <ArrowUp />
                      </SlideAction>
                      <SlideAction
                        label="Move slide down"
                        disabled={index === project.slides.length - 1}
                        onClick={() => moveSlide(slide.id, 1)}
                      >
                        <ArrowDown />
                      </SlideAction>
                      <SlideAction
                        label="Duplicate slide"
                        onClick={() => duplicateSlide(slide.id)}
                      >
                        <Copy />
                      </SlideAction>
                      <SlideAction
                        label="Delete slide"
                        disabled={project.slides.length === 1}
                        onClick={() => removeSlide(slide.id)}
                      >
                        <Trash2 />
                      </SlideAction>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <Button className="mt-3 w-full" variant="outline" onClick={addSlide}>
            <Plus data-icon="inline-start" />
            Add slide
          </Button>
        </aside>

        <section className="flex min-h-[38rem] min-w-0 flex-col items-center justify-center px-5 py-8 md:px-10 lg:min-h-0">
          <div className="mb-4 flex w-full max-w-96 items-center justify-between text-xs text-black/45">
            <span>
              Slide {activeIndex + 1} of {project.slides.length}
            </span>
            <span>1080 × 1920</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              ref={slideCanvasRef}
              key={activeSlide.id}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.16 }}
              className="relative aspect-[9/16] max-h-[68svh] w-full max-w-96 overflow-hidden rounded-[1.75rem] shadow-[0_28px_70px_rgba(35,36,47,.22)] ring-1 ring-black/10"
              style={{
                background: activeTheme.background,
                containerType: "inline-size",
              }}
            >
              {activeSlide.image && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${JSON.stringify(activeSlide.image.dataUrl)})`,
                  }}
                />
              )}
              {activeSlide.textLayers.map((layer) => {
                if (!layer.visible) return null

                const isSelected = selectedLayer?.id === layer.id
                const isEditing = editingLayerId === layer.id

                return (
                  <div
                    key={layer.id}
                    className={cn(
                      "absolute z-10 touch-none text-pretty",
                      layer.locked ? "cursor-default" : "cursor-text",
                      isSelected &&
                        "outline-2 outline-offset-2 outline-[#fff58f]"
                    )}
                    data-layer-id={layer.id}
                    data-layer-role={layer.role}
                    style={getTextLayerStyle(layer, activeTheme)}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      startInlineEditing(layer)
                    }}
                    onPointerDown={(event) =>
                      startLayerInteraction(event, layer, "drag")
                    }
                    onPointerMove={moveLayerInteraction}
                    onPointerUp={(event) =>
                      finishLayerInteraction(event, layer)
                    }
                    onPointerCancel={cancelLayerInteraction}
                  >
                    <div className="size-full overflow-hidden">
                      <span
                        ref={isEditing ? inlineEditorRef : undefined}
                        className="whitespace-pre-wrap"
                        style={getTextLayerContentStyle(layer)}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        role={isEditing ? "textbox" : undefined}
                        aria-label={
                          isEditing ? `Edit ${layer.name}` : undefined
                        }
                        aria-multiline={isEditing || undefined}
                        onPointerDown={(event) => {
                          if (isEditing) event.stopPropagation()
                        }}
                        onBlur={(event) =>
                          finishInlineEditing(
                            layer,
                            event.currentTarget.innerText
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.currentTarget.innerText = layer.text
                            setEditingLayerId(null)
                            event.currentTarget.blur()
                          }
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                      >
                        {layer.text || `Add ${layer.name.toLowerCase()} text`}
                      </span>
                    </div>

                    {isSelected && !isEditing && !layer.locked && (
                      <button
                        type="button"
                        aria-label={`Resize ${layer.name}`}
                        className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-full border-2 border-[#4758c7] bg-white shadow-sm"
                        onPointerDown={(event) =>
                          startLayerInteraction(event, layer, "resize")
                        }
                        onPointerMove={(event) => {
                          event.stopPropagation()
                          moveLayerInteraction(event)
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation()
                          finishLayerInteraction(event, layer)
                        }}
                        onPointerCancel={(event) => {
                          event.stopPropagation()
                          cancelLayerInteraction(event)
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="relative border-t border-black/10 bg-[#f8f7f4] lg:h-full lg:min-h-0 lg:border-t-0 lg:border-l">
          <div className="p-5 lg:absolute lg:inset-0 lg:overflow-y-auto">
            <div className="mb-6">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles
                  className="size-4 text-[#f06f5d]"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold">Slide setup</h2>
              </div>
              <p className="text-xs leading-relaxed text-black/45">
                Changes are saved in this browser. AI rewrites stay fully
                editable.
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                disabled={regeneratingSlideId !== null}
                onClick={() => void regenerateActiveSlide()}
              >
                {regeneratingSlideId === activeSlide.id ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {regeneratingSlideId === activeSlide.id
                  ? "Rewriting…"
                  : "Rewrite this slide"}
              </Button>
            </div>

            <fieldset className="mb-6">
              <legend className="mb-3 text-xs font-semibold text-black/60">
                Text style
              </legend>
              <div className="space-y-2">
                {textStyles.map((textStyle) => (
                  <button
                    key={textStyle.id}
                    type="button"
                    onClick={() => selectTextStyle(textStyle.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                      isTextStyleActive(textStyle.id)
                        ? "border-[#4758c7] bg-[#eef0ff]"
                        : "border-black/10 bg-white hover:border-black/20"
                    )}
                  >
                    <TextStyleSwatch textStyleId={textStyle.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold">
                        {textStyle.name}
                      </span>
                      <span className="block truncate text-[11px] text-black/45">
                        {textStyle.description}
                      </span>
                    </span>
                    {isTextStyleActive(textStyle.id) && (
                      <Check className="size-4 shrink-0 text-[#4758c7]" />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            {selectedLayer && selectedFont && (
              <fieldset className="mb-6 border-t border-black/10 pt-5">
                <legend className="sr-only">Selected text layer</legend>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-black/60">
                      {selectedLayer.name} layer
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-black/45">
                      Drag to move · use the corner to resize · double-click or
                      double-tap to type
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-[#eef0ff] px-2 py-1 text-[10px] font-medium text-[#4758c7]">
                      {selectedFont.name} selected
                    </span>
                    <button
                      type="button"
                      aria-label={
                        selectedLayer.visible
                          ? `Delete ${selectedLayer.name.toLowerCase()} layer`
                          : `Restore ${selectedLayer.name.toLowerCase()} layer`
                      }
                      title={
                        selectedLayer.visible
                          ? "Delete this text box"
                          : "Restore this text box"
                      }
                      onClick={() => toggleLayerVisibility(selectedLayer)}
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                        selectedLayer.visible
                          ? "border-black/10 bg-white text-black/45 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          : "border-[#4758c7]/30 bg-[#eef0ff] text-[#4758c7]"
                      )}
                    >
                      {selectedLayer.visible ? (
                        <Trash2 className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {!selectedLayer.visible && (
                  <p className="mb-4 rounded-lg bg-black/5 px-2.5 py-2 text-[11px] leading-relaxed text-black/55">
                    This text box is deleted from the slide. Its text and style
                    are kept — restore it with the button above.
                  </p>
                )}

                <div>
                  <p className="mb-2 text-[11px] font-medium text-black/50">
                    Font
                  </p>
                  <Select
                    value={selectedFont.id}
                    onValueChange={(value) =>
                      updateSelectedLayerStyle({
                        fontFamily: value as TextFontFamily,
                      })
                    }
                  >
                    <SelectTrigger className="h-auto w-full justify-between rounded-xl border-black/10 bg-white px-3 py-2.5 hover:border-black/20 focus-visible:border-[#4758c7] focus-visible:ring-[#4758c7]/10">
                      <SelectValue>
                        {(value: TextFontFamily) => {
                          const font =
                            FONT_OPTIONS.find(
                              (option) => option.id === value
                            ) ?? FONT_OPTIONS[0]
                          return (
                            <span className="flex items-baseline gap-2">
                              <span style={{ fontFamily: font.stack }}>
                                {font.sample}
                              </span>
                              <span className="text-xs text-black/45">
                                {font.name}
                              </span>
                            </span>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-black/10">
                      {FONT_OPTIONS.map((font) => (
                        <SelectItem
                          key={font.id}
                          value={font.id}
                          className="focus:bg-[#eef0ff] focus:text-[#4758c7] data-[highlighted]:bg-[#eef0ff] data-[highlighted]:text-[#4758c7]"
                        >
                          <span
                            className="flex items-baseline gap-2"
                            style={{ fontFamily: font.stack }}
                          >
                            {font.sample}
                            <span className="text-xs text-black/45">
                              {font.name}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 flex items-center justify-between text-[11px] font-medium text-black/50">
                    <span>Font size</span>
                    <span className="tabular-nums">
                      {selectedLayer.style.fontSize.toFixed(1)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="2"
                    max="14"
                    step="0.1"
                    value={selectedLayer.style.fontSize}
                    onChange={(event) =>
                      updateSelectedLayerStyle({
                        fontSize: Number(event.target.value),
                      })
                    }
                    className="w-full accent-[#4758c7]"
                  />
                </label>

                <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                  <div>
                    <p className="mb-2 text-[11px] font-medium text-black/50">
                      Alignment
                    </p>
                    <div className="grid grid-cols-3 rounded-xl border border-black/10 bg-white p-1">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([alignment, Icon]) => (
                        <button
                          key={alignment}
                          type="button"
                          aria-label={`Align ${alignment}`}
                          aria-pressed={selectedLayer.style.align === alignment}
                          onClick={() =>
                            updateSelectedLayerStyle({ align: alignment })
                          }
                          className={cn(
                            "grid h-8 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-[#4758c7]",
                            selectedLayer.style.align === alignment
                              ? "bg-[#eef0ff] text-[#4758c7]"
                              : "text-black/45 hover:bg-black/5"
                          )}
                        >
                          <Icon className="size-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <label>
                    <span className="mb-2 block text-[11px] font-medium text-black/50">
                      Text
                    </span>
                    <input
                      type="color"
                      aria-label="Text color"
                      value={getColorInputValue(
                        selectedLayer.style.color.type === "custom"
                          ? selectedLayer.style.color.value
                          : resolveLayerColor(
                              selectedLayer.style.color,
                              activeTheme
                            ),
                        "#ffffff"
                      )}
                      onChange={(event) =>
                        updateSelectedLayerStyle({
                          color: { type: "custom", value: event.target.value },
                        })
                      }
                      className="h-10 w-12 cursor-pointer rounded-xl border border-black/10 bg-white p-1"
                    />
                  </label>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium text-black/50">
                    Text box
                  </p>
                  <div className="grid grid-cols-3 rounded-xl border border-black/10 bg-white p-1 text-[11px] font-medium">
                    {(
                      [
                        ["none", "None"],
                        ["line", "Behind text"],
                        ["block", "Full box"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={selectedBackgroundMode === mode}
                        onClick={() => selectBackgroundMode(mode)}
                        className={cn(
                          "min-h-9 rounded-lg px-1 transition focus-visible:outline-2 focus-visible:outline-[#4758c7]",
                          selectedBackgroundMode === mode
                            ? "bg-[#eef0ff] text-[#4758c7]"
                            : "text-black/45 hover:bg-black/5"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBackgroundMode !== "none" && (
                  <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-medium text-black/50">
                        Box color
                      </span>
                      <input
                        type="color"
                        aria-label="Text box color"
                        value={getColorInputValue(
                          selectedLayer.style.backgroundColor,
                          "#ffffff"
                        )}
                        onChange={(event) =>
                          updateSelectedLayerStyle({
                            backgroundColor: event.target.value,
                          })
                        }
                        className="h-8 w-11 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
                      />
                    </div>
                    <EditorRange
                      label="Opacity"
                      value={getBackgroundOpacity(selectedLayer)}
                      display={`${Math.round(getBackgroundOpacity(selectedLayer) * 100)}%`}
                      min={0.1}
                      max={1}
                      step={0.05}
                      onChange={(backgroundOpacity) =>
                        updateSelectedLayerStyle({ backgroundOpacity })
                      }
                    />
                    <EditorRange
                      label="Padding"
                      value={selectedLayer.style.padding ?? 0}
                      display={(selectedLayer.style.padding ?? 0).toFixed(1)}
                      min={0}
                      max={4}
                      step={0.1}
                      onChange={(padding) =>
                        updateSelectedLayerStyle({ padding })
                      }
                    />
                    <EditorRange
                      label="Corners"
                      value={selectedLayer.style.borderRadius ?? 0}
                      display={(selectedLayer.style.borderRadius ?? 0).toFixed(
                        1
                      )}
                      min={0}
                      max={5}
                      step={0.1}
                      onChange={(borderRadius) =>
                        updateSelectedLayerStyle({ borderRadius })
                      }
                    />
                  </div>
                )}
              </fieldset>
            )}

            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold text-black/60">Image</p>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  handleImageUpload(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              <div className="space-y-2">
                <Button
                  className="w-full bg-[#4758c7] text-white hover:bg-[#3e4db0]"
                  onClick={() => setImageSearchOpen(true)}
                >
                  <Search data-icon="inline-start" />
                  Search Pexels
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-black/10 bg-white hover:border-black/20 hover:bg-white"
                  onClick={() => void autoFillMissingImages()}
                  disabled={isAutoFillingImages}
                >
                  {isAutoFillingImages ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <Images data-icon="inline-start" />
                  )}
                  Auto-fill missing images
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-black/10 bg-white hover:border-black/20 hover:bg-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus data-icon="inline-start" />
                  {activeSlide.image ? "Upload replacement" : "Upload image"}
                </Button>
              </div>
              {activeSlide.image && (
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-black/45">
                  <span className="truncate">{activeSlide.image.name}</span>
                  <button
                    type="button"
                    className="font-medium text-red-700 hover:underline focus-visible:outline-2"
                    onClick={() => updateActiveSlide({ image: null })}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-black/60">
                    Headline
                  </span>
                  {hookLayer && !hookLayer.visible && (
                    <button
                      type="button"
                      onClick={() => toggleLayerVisibility(hookLayer)}
                      className="text-[10px] font-medium text-[#4758c7] hover:underline focus-visible:outline-2"
                    >
                      Deleted · Restore
                    </button>
                  )}
                </span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm leading-relaxed transition outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                  maxLength={120}
                  value={hookLayer?.text ?? ""}
                  onFocus={() => hookLayer && setSelectedLayerId(hookLayer.id)}
                  onChange={(event) =>
                    hookLayer &&
                    updateTextLayer(hookLayer.id, { text: event.target.value })
                  }
                />
                <span className="mt-1 block text-right text-[10px] text-black/35 tabular-nums">
                  {hookLayer?.text.length ?? 0}/120
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-black/60">
                    Supporting text
                  </span>
                  {bodyLayer && !bodyLayer.visible && (
                    <button
                      type="button"
                      onClick={() => toggleLayerVisibility(bodyLayer)}
                      className="text-[10px] font-medium text-[#4758c7] hover:underline focus-visible:outline-2"
                    >
                      Deleted · Restore
                    </button>
                  )}
                </span>
                <textarea
                  className="min-h-20 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm leading-relaxed transition outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                  maxLength={180}
                  value={bodyLayer?.text ?? ""}
                  onFocus={() => bodyLayer && setSelectedLayerId(bodyLayer.id)}
                  onChange={(event) =>
                    bodyLayer &&
                    updateTextLayer(bodyLayer.id, { text: event.target.value })
                  }
                />
              </label>
            </div>
          </div>
        </aside>
      </div>

      <CompositionDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApply={applyComposition}
      />
      <ImageSearchDialog
        open={imageSearchOpen}
        initialQuery={getSlideImageQuery()}
        onClose={() => setImageSearchOpen(false)}
        onSelect={(image) => {
          updateActiveSlide({ image })
          setNotice(`Photo added to slide ${activeIndex + 1}.`)
        }}
      />
    </main>
  )
}

function getSlideImageQuery() {
  return DEFAULT_IMAGE_QUERY
}

function getAppliedTextStyle(slides: SlideshowSlide[]): TextStyleId | null {
  const hasYellowCover = slides.every((slide, index) =>
    index === 0
      ? slide.layoutId === "yellow-cover"
      : slide.layoutId === "yellow-continuation"
  )
  if (hasYellowCover) return "yellow-cover"

  return (
    textStyles.find((textStyle) =>
      slides.every((slide) => slide.layoutId === textStyle.id)
    )?.id ?? null
  )
}

function toSlideImage(result: ImageSearchResult): SlideImage {
  return {
    id: `pexels-${result.id}`,
    name: result.alt || "Pexels photo",
    dataUrl: result.imageUrl,
    source: {
      provider: "pexels",
      photographer: result.photographer,
      photographerUrl: result.photographerUrl,
      photoUrl: result.photoUrl,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getTextLayerStyle(
  layer: TextLayer,
  theme: SlideshowTheme
): CSSProperties {
  const { rect, style } = layer
  const fontFamily =
    FONT_OPTIONS.find((font) => font.id === style.fontFamily)?.stack ??
    FONT_OPTIONS[0].stack
  const backgroundColor = getLayerBackgroundColor(layer)

  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
    color: resolveLayerColor(style.color, theme),
    backgroundColor:
      style.backgroundMode === "line" ? undefined : backgroundColor,
    fontFamily,
    fontSize: `${style.fontSize}cqw`,
    fontWeight: style.fontWeight,
    lineHeight: getLineModeLineHeight(style),
    letterSpacing: `${style.letterSpacing}em`,
    textAlign: style.align,
    textTransform: style.textTransform,
    textShadow: getTextShadow(style),
    padding:
      style.backgroundMode === "line" || !style.padding
        ? undefined
        : `${style.padding}cqw`,
    borderRadius:
      style.backgroundMode === "line" || !style.borderRadius
        ? undefined
        : `${style.borderRadius}cqw`,
  }
}

function getLineModeLineHeight(style: TextLayerStyle) {
  if (
    style.backgroundMode !== "line" ||
    !style.backgroundColor ||
    !style.padding
  ) {
    return style.lineHeight
  }

  // box-decoration-break: clone paints the padding around every wrapped
  // line without reserving extra space for it, so a tight line-height lets
  // adjacent lines' padded backgrounds overlap and double up their opacity,
  // reading as a dark seam between lines. Widen the leading just enough to
  // keep the padded boxes apart.
  const minLineHeight = 1 + (2 * style.padding) / style.fontSize
  return Math.max(style.lineHeight, minLineHeight)
}

function getTextLayerContentStyle(layer: TextLayer): CSSProperties | undefined {
  const { style } = layer
  if (style.backgroundMode !== "line" || !style.backgroundColor) return

  return {
    backgroundColor: getLayerBackgroundColor(layer),
    padding: style.padding ? `${style.padding}cqw` : undefined,
    borderRadius: style.borderRadius ? `${style.borderRadius}cqw` : undefined,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  }
}

const EXPORT_WIDTH = 1080
const EXPORT_HEIGHT = 1920

function SlideExportCard({
  slide,
  theme,
}: {
  slide: SlideshowSlide
  theme: SlideshowTheme
}) {
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{ background: theme.background, containerType: "inline-size" }}
    >
      {slide.image && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${JSON.stringify(slide.image.dataUrl)})`,
          }}
        />
      )}
      {slide.textLayers.map(
        (layer) =>
          layer.visible && (
            <div
              key={layer.id}
              className="absolute z-10 overflow-hidden text-pretty"
              style={getTextLayerStyle(layer, theme)}
            >
              <span style={getTextLayerContentStyle(layer)}>{layer.text}</span>
            </div>
          )
      )}
    </div>
  )
}

async function renderSlideToBlob(
  slide: SlideshowSlide,
  theme: SlideshowTheme
): Promise<Blob | null> {
  // html-to-image renders a blank canvas for nodes placed far outside the
  // viewport (e.g. position: fixed with a large negative offset), so the
  // export target is kept at normal, in-viewport coordinates and hidden by
  // clipping it inside a zero-size overflow:hidden ancestor instead.
  const clipper = document.createElement("div")
  clipper.style.position = "fixed"
  clipper.style.top = "0"
  clipper.style.left = "0"
  clipper.style.width = "0"
  clipper.style.height = "0"
  clipper.style.overflow = "hidden"
  clipper.style.pointerEvents = "none"

  const container = document.createElement("div")
  container.style.width = `${EXPORT_WIDTH}px`
  container.style.height = `${EXPORT_HEIGHT}px`
  clipper.appendChild(container)
  document.body.appendChild(clipper)

  const root = createRoot(container)
  try {
    flushSync(() => {
      root.render(<SlideExportCard slide={slide} theme={theme} />)
    })

    return await toBlob(container, {
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      pixelRatio: 1,
    })
  } finally {
    root.unmount()
    clipper.remove()
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function slugifyFilename(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "slideshow"
}

function getBackgroundOpacity(layer: TextLayer) {
  if (layer.style.backgroundOpacity !== undefined) {
    return layer.style.backgroundOpacity
  }

  const alpha = layer.style.backgroundColor?.match(
    /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/i
  )?.[1]
  return alpha ? clamp(Number(alpha), 0, 1) : 1
}

function getLayerBackgroundColor(layer: TextLayer) {
  const { backgroundColor, backgroundOpacity } = layer.style
  if (!backgroundColor) return undefined
  if (backgroundOpacity === undefined) return backgroundColor

  const rgb = parseHexColor(backgroundColor)
  return rgb
    ? `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${backgroundOpacity})`
    : backgroundColor
}

function parseHexColor(value: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (!match) return null

  return {
    red: Number.parseInt(match[1]!, 16),
    green: Number.parseInt(match[2]!, 16),
    blue: Number.parseInt(match[3]!, 16),
  }
}

function getColorInputValue(value: string | null, fallback: string) {
  if (value && /^#[\da-f]{6}$/i.test(value)) return value
  if (value?.includes("0,0,0") || value?.includes("0, 0, 0")) return "#000000"
  if (value?.includes("255,255,255") || value?.includes("255, 255, 255")) {
    return "#ffffff"
  }
  return fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function EditorRange({
  display,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  display: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step: number
  value: number
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 flex items-center justify-between text-[10px] text-black/45">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#4758c7]"
      />
    </label>
  )
}

function TextStyleSwatch({ textStyleId }: { textStyleId: TextStyleId }) {
  return (
    <span className="relative block size-10 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(145deg,#8e8478,#3f453d)] ring-1 ring-black/10">
      <span
        className={cn(
          "absolute block",
          textStyleId === "clean-white" &&
            "top-[30%] right-[15%] left-[15%] h-1 bg-white",
          textStyleId === "soft-yellow" &&
            "top-[25%] right-[35%] left-[10%] h-1 bg-[#fff58f]",
          textStyleId === "yellow-cover" &&
            "top-[20%] right-[14%] left-[14%] h-3 bg-[#fff58f]",
          textStyleId === "label-body" &&
            "top-[22%] right-[10%] left-[10%] h-2.5 rounded-sm bg-white"
        )}
      />
      <span
        className={cn(
          "absolute block h-0.5",
          textStyleId === "clean-white" &&
            "top-[48%] right-[25%] left-[25%] bg-white/80",
          textStyleId === "soft-yellow" &&
            "top-[43%] right-[20%] left-[10%] bg-[#fff58f]/80",
          textStyleId === "yellow-cover" &&
            "top-[60%] right-[30%] left-[30%] bg-white/90",
          textStyleId === "label-body" &&
            "top-[58%] right-[20%] left-[20%] bg-white/85"
        )}
      />
    </span>
  )
}

function SlideAction({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactElement<{ className?: string }>
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md transition hover:bg-black/5 hover:text-black focus-visible:outline-2 focus-visible:outline-[#4758c7] disabled:pointer-events-none disabled:opacity-20 [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}
