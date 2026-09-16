"use client"

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  ImagePlus,
  Images,
  Layers3,
  LoaderCircle,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
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
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { ImageSearchDialog } from "@/components/image-search-dialog"
import { applyGeneratedCopy } from "@/lib/composition"
import {
  parseRichText,
  richTextToHtml,
  serializeEditableNode,
} from "@/lib/rich-text"
import { generatedSlideSchema } from "@/lib/ai/slideshow-generation"
import { autoFillSlideImages } from "@/lib/images/auto-fill"
import { createBlankProject, saveProject } from "@/lib/actions/slideshows"
import {
  addProductContentImage,
  getProductProfile,
  removeProductContentImage,
} from "@/lib/actions/products"
import type { ProductContentImage } from "@/lib/products/product-profile"
import {
  applySlideLayout,
  createCustomTextLayer,
  createNotificationOverlay,
  createSlide,
  getTextLayer,
  getTextShadow,
  resolveLayerColor,
  resolveCarouselTextStyle,
  slideshowThemes,
  starterProject,
  textStyles,
  type ImageOverlay,
  type LayerRect,
  type NotificationOverlay,
  type SlideshowProject,
  type SlideshowSlide,
  type SlideshowTheme,
  type TextFontFamily,
  type TextLayer,
  type TextLayerStyle,
  type TextStyleId,
} from "@/lib/slideshow"

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

type NotificationInteraction = {
  layerId: string
  pointerId: number
  startX: number
  startY: number
  startPos: { x: number; y: number }
  moved: boolean
}

type ImageResizeCorner = "nw" | "ne" | "sw" | "se"

type ImageLayerInteraction = {
  layerId: string
  mode: "drag" | ImageResizeCorner
  pointerId: number
  startX: number
  startY: number
  startRect: LayerRect
  naturalAspect: number
  moved: boolean
}

function cloneStarterProject() {
  return structuredClone(starterProject)
}

export function SlideshowStudio({
  initialProject,
}: {
  initialProject: SlideshowProject
}) {
  const router = useRouter()
  const [project, setProject] = useState<SlideshowProject>(initialProject)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">(
    "saved"
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [imageSearchOpen, setImageSearchOpen] = useState(false)
  const [isAutoFillingImages, setIsAutoFillingImages] = useState(false)
  const [isExportingZip, setIsExportingZip] = useState(false)
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(
    null
  )
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [selectedImageLayerId, setSelectedImageLayerId] = useState<
    string | null
  >(null)
  const [selectedNotificationLayerId, setSelectedNotificationLayerId] =
    useState<string | null>(null)
  const [contentImages, setContentImages] = useState<ProductContentImage[]>([])
  const [isUploadingContentImage, setIsUploadingContentImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentImageInputRef = useRef<HTMLInputElement>(null)
  const overlayImageInputRef = useRef<HTMLInputElement>(null)
  const slideCanvasRef = useRef<HTMLDivElement>(null)
  const inlineEditorRef = useRef<HTMLSpanElement>(null)
  const layerInteractionRef = useRef<LayerInteraction | null>(null)
  const imageLayerInteractionRef = useRef<ImageLayerInteraction | null>(null)
  const notificationInteractionRef = useRef<NotificationInteraction | null>(
    null
  )
  const notificationIconInputRef = useRef<HTMLInputElement>(null)
  const copiedLayerRef = useRef<TextLayer | null>(null)
  const lastTapRef = useRef<{ layerId: string; timestamp: number } | null>(null)
  const isFirstRenderRef = useRef(true)
  const pendingCaretPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const productId = project.productId

    if (!productId) {
      const timeout = window.setTimeout(() => setContentImages([]), 0)
      return () => window.clearTimeout(timeout)
    }

    void getProductProfile(productId).then((product) => {
      if (!cancelled) setContentImages(product?.contentImages ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [project.productId])

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    // Reflect the pending save soon, not just once the debounce delay
    // elapses and the request actually goes out - otherwise the badge
    // shows stale info for the whole 800ms+ window after an edit. Deferred
    // to the next frame (rAF) rather than set synchronously in this same
    // effect: setting it inline landed this state update in the exact same
    // commit as whatever change triggered it (e.g. text layer content
    // syncing while still focused), which could race the browser's own
    // in-progress handling of that edit and reset cursor position while
    // typing. Giving the browser a frame to finish first avoids that.
    const savingFrame = requestAnimationFrame(() => setSaveState("saving"))
    const timeout = window.setTimeout(() => {
      void saveProject(project)
        .then(() => setSaveState("saved"))
        .catch((saveError) => {
          console.error("saveProject failed:", saveError)
          setSaveState("failed")
          setNotice("Could not save. Check your connection and try again.")
        })
    }, 800)

    return () => {
      cancelAnimationFrame(savingFrame)
      window.clearTimeout(timeout)
    }
  }, [project])

  useEffect(() => installCursorJumpDiagnostics(), [])

  async function saveNow() {
    setSaveState("saving")
    try {
      await saveProject(project)
      setSaveState("saved")
    } catch (saveError) {
      console.error("saveProject failed:", saveError)
      setSaveState("failed")
      setNotice("Could not save. Check your connection and try again.")
    }
  }

  useEffect(() => {
    const editor = inlineEditorRef.current
    if (!editingLayerId || !editor) return

    editor.focus()
    const selection = window.getSelection()
    if (!selection) return

    // Entering edit mode remounts this span (see the `key` below), which
    // destroys whatever native cursor placement the click that triggered
    // this just made. Restoring it from the click's screen coordinates -
    // instead of always selecting everything - is what makes double-
    // clicking at a specific spot actually put the cursor there instead of
    // it jumping to the very front every time.
    const point = pendingCaretPointRef.current
    pendingCaretPointRef.current = null
    const clickRange = point && getCaretRangeFromPoint(point.x, point.y, editor)

    if (clickRange) {
      selection.removeAllRanges()
      selection.addRange(clickRange)
      return
    }

    const range = document.createRange()
    range.selectNodeContents(editor)
    selection.removeAllRanges()
    selection.addRange(range)
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
  const selectedImageLayer =
    (activeSlide.imageLayers ?? []).find(
      (layer) => layer.id === selectedImageLayerId
    ) ?? null
  const selectedNotificationLayer =
    (activeSlide.notificationLayers ?? []).find(
      (layer) => layer.id === selectedNotificationLayerId
    ) ?? null
  const selectedLayer =
    activeSlide.textLayers.find((layer) => layer.id === selectedLayerId) ??
    hookLayer ??
    bodyLayer
  const explicitlySelectedLayer =
    selectedLayerId !== null
      ? (activeSlide.textLayers.find((layer) => layer.id === selectedLayerId) ??
        null)
      : null
  const navDeleteTarget:
    | { kind: "layer"; layer: TextLayer }
    | { kind: "overlay"; layer: ImageOverlay }
    | { kind: "notification"; layer: NotificationOverlay }
    | { kind: "image" }
    | null = explicitlySelectedLayer
    ? { kind: "layer", layer: explicitlySelectedLayer }
    : selectedImageLayer
      ? { kind: "overlay", layer: selectedImageLayer }
      : selectedNotificationLayer
        ? { kind: "notification", layer: selectedNotificationLayer }
        : activeSlide.image
          ? { kind: "image" }
          : null
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

  function updateImageLayer(layerId: string, changes: Partial<ImageOverlay>) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              imageLayers: (slide.imageLayers ?? []).map((layer) =>
                layer.id === layerId ? { ...layer, ...changes } : layer
              ),
            }
          : slide
      ),
    }))
  }

  function addImageOverlay(image: {
    name: string
    dataUrl: string
    rect: LayerRect
    naturalAspect: number
  }) {
    const layer: ImageOverlay = {
      id: crypto.randomUUID(),
      name: image.name,
      dataUrl: image.dataUrl,
      rect: image.rect,
      locked: false,
      imageScale: 1,
      naturalAspect: image.naturalAspect,
    }
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? { ...slide, imageLayers: [...(slide.imageLayers ?? []), layer] }
          : slide
      ),
    }))
    setSelectedImageLayerId(layer.id)
    setSelectedLayerId(null)
    setSelectedNotificationLayerId(null)
  }

  function removeImageOverlay(layerId: string) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              imageLayers: (slide.imageLayers ?? []).filter(
                (layer) => layer.id !== layerId
              ),
            }
          : slide
      ),
    }))
    setSelectedImageLayerId(null)
  }

  function addNotificationOverlay() {
    const layer = createNotificationOverlay()
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              notificationLayers: [...(slide.notificationLayers ?? []), layer],
            }
          : slide
      ),
    }))
    setSelectedNotificationLayerId(layer.id)
    setSelectedLayerId(null)
    setSelectedImageLayerId(null)
  }

  function updateNotificationLayer(
    layerId: string,
    changes: Partial<NotificationOverlay>
  ) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              notificationLayers: (slide.notificationLayers ?? []).map(
                (layer) =>
                  layer.id === layerId ? { ...layer, ...changes } : layer
              ),
            }
          : slide
      ),
    }))
  }

  function removeNotificationLayer(layerId: string) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? {
              ...slide,
              notificationLayers: (slide.notificationLayers ?? []).filter(
                (layer) => layer.id !== layerId
              ),
            }
          : slide
      ),
    }))
    setSelectedNotificationLayerId(null)
  }

  function startNotificationInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: NotificationOverlay
  ) {
    if (layer.locked) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedNotificationLayerId(layer.id)
    setSelectedLayerId(null)
    setSelectedImageLayerId(null)
    notificationInteractionRef.current = {
      layerId: layer.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPos: { x: layer.x, y: layer.y },
      moved: false,
    }
  }

  function moveNotificationInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = notificationInteractionRef.current
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

    const layer = (activeSlide.notificationLayers ?? []).find(
      (item) => item.id === interaction.layerId
    )
    const width = layer?.width ?? 84
    const start = interaction.startPos

    updateNotificationLayer(interaction.layerId, {
      x: clamp(start.x + deltaX, 0, 100 - width),
      y: clamp(start.y + deltaY, 0, 95),
    })
  }

  function finishNotificationInteraction(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const interaction = notificationInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    notificationInteractionRef.current = null
  }

  function handleNotificationIconUpload(file: File | undefined) {
    if (!file || !selectedNotificationLayer) return
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file such as PNG, JPEG, or WebP.")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice("Choose an image smaller than 15 MB.")
      return
    }

    const layerId = selectedNotificationLayer.id
    resizeImageToDataUrl(file)
      .then(({ dataUrl }) => {
        updateNotificationLayer(layerId, { appIconDataUrl: dataUrl })
      })
      .catch(() => setNotice("Could not process this image. Try again."))
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

  function addTextLayer(layer: TextLayer) {
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) =>
        slide.id === current.activeSlideId
          ? { ...slide, textLayers: [...slide.textLayers, layer] }
          : slide
      ),
    }))
    setSelectedLayerId(layer.id)
  }

  function addTextBox() {
    const layer = createCustomTextLayer()
    addTextLayer(layer)
    setEditingLayerId(layer.id)
  }

  function handleNavDelete() {
    if (!navDeleteTarget) return
    if (navDeleteTarget.kind === "image") {
      updateActiveSlide({ image: null })
    } else if (navDeleteTarget.kind === "overlay") {
      removeImageOverlay(navDeleteTarget.layer.id)
    } else if (navDeleteTarget.kind === "notification") {
      removeNotificationLayer(navDeleteTarget.layer.id)
    } else {
      toggleLayerVisibility(navDeleteTarget.layer)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      if (!navDeleteTarget) return
      if (
        navDeleteTarget.kind === "layer" &&
        (!navDeleteTarget.layer.visible || navDeleteTarget.layer.locked)
      ) {
        return
      }
      if (navDeleteTarget.kind === "overlay" && navDeleteTarget.layer.locked) {
        return
      }
      if (
        navDeleteTarget.kind === "notification" &&
        navDeleteTarget.layer.locked
      ) {
        return
      }

      const active = document.activeElement
      const isEditingText =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      if (isEditingText) return

      event.preventDefault()
      handleNavDelete()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // handleNavDelete/toggleLayerVisibility/removeImageOverlay read current
    // state through setProject's updater, so omitting them here is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navDeleteTarget])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCopy = (event.metaKey || event.ctrlKey) && event.key === "c"
      const isPaste = (event.metaKey || event.ctrlKey) && event.key === "v"
      if (!isCopy && !isPaste) return
      if (editingLayerId) return

      const active = document.activeElement
      const isEditingText =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      if (isEditingText) return

      if (isCopy) {
        if (!explicitlySelectedLayer) return
        copiedLayerRef.current = structuredClone(explicitlySelectedLayer)
        setNotice(`Copied "${explicitlySelectedLayer.name}".`)
      } else if (copiedLayerRef.current) {
        const source = copiedLayerRef.current
        addTextLayer({
          ...structuredClone(source),
          id: crypto.randomUUID(),
          rect: {
            ...source.rect,
            x: clamp(source.rect.x + 3, 0, 100 - source.rect.width),
            y: clamp(source.rect.y + 3, 0, 100 - source.rect.height),
          },
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // addTextLayer only wraps updateProject, which reads current state
    // through setProject's updater, so omitting it here is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLayerId, explicitlySelectedLayer])

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
    setSelectedImageLayerId(null)
    setSelectedNotificationLayerId(null)
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
      pendingCaretPointRef.current = { x: event.clientX, y: event.clientY }
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

  function startImageLayerInteraction(
    event: ReactPointerEvent<HTMLElement>,
    layer: ImageOverlay,
    mode: ImageLayerInteraction["mode"]
  ) {
    if (layer.locked) return
    if (event.pointerType === "mouse" && event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedImageLayerId(layer.id)
    setSelectedLayerId(null)
    setSelectedNotificationLayerId(null)
    imageLayerInteractionRef.current = {
      layerId: layer.id,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: structuredClone(layer.rect),
      naturalAspect: layer.naturalAspect,
      moved: false,
    }
  }

  function moveImageLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = imageLayerInteractionRef.current
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
            // A box bigger than the canvas (allowed since resize can now
            // overshoot the border) makes "100 - start.width" negative -
            // clamp's min/max need to swap order in that case, or every
            // drag would collapse to the same spot.
            x: clamp(
              start.x + deltaX,
              Math.min(0, 100 - start.width),
              Math.max(0, 100 - start.width)
            ),
            y: clamp(
              start.y + deltaY,
              Math.min(0, 100 - start.height),
              Math.max(0, 100 - start.height)
            ),
          }
        : computeResizedRect(
            start,
            interaction.mode,
            deltaX,
            deltaY,
            interaction.naturalAspect
          )

    updateImageLayer(interaction.layerId, { rect })
  }

  function finishImageLayerInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = imageLayerInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    imageLayerInteractionRef.current = null
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

  /** Removes a <strong>/<b> wrapper, keeping its children in place. */
  function unwrapBoldElement(element: Element) {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    parent.removeChild(element)
  }

  /**
   * Explicit bold toggle, bound to Cmd/Ctrl+B while editing, instead of
   * relying on the browser's native execCommand("bold"). execCommand
   * decides whether text is "already bold" from the ambient computed
   * font-weight, which gets confused when a layer's base style is already
   * semi-bold (e.g. the hook layer's 600 weight) - the first press can be
   * read as "un-bold" and produce no detectable change, so it looked like
   * bolding silently failed on the first try. Always inserting/removing a
   * literal <strong> ourselves removes that ambiguity entirely.
   */
  function toggleBoldSelection() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return
    }

    const range = selection.getRangeAt(0)
    const anchor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement
    const strongAncestor = anchor?.closest("strong, b")

    if (strongAncestor) {
      unwrapBoldElement(strongAncestor)
      return
    }

    // The selection isn't fully inside one bold span, but it can still
    // overlap one at either edge (e.g. extending a bold word into the
    // plain text right next to it). Unwrap those first: leaving them in
    // place let surroundContents silently nest a new <strong> inside the
    // old one instead of throwing, which corrupted the ** marker
    // serialization into unparseable runs of asterisks.
    const editableRoot =
      anchor?.closest<HTMLElement>('[contenteditable="true"]') ?? anchor
    const overlapping = editableRoot
      ? Array.from(editableRoot.querySelectorAll("strong, b")).filter(
          (element) => range.intersectsNode(element)
        )
      : []

    let workingRange = range
    if (overlapping.length > 0) {
      // Unwrapping can lead the browser to merge now-adjacent text nodes,
      // which silently invalidates any Range boundary point that was
      // pointing into whichever node got merged away - the range would
      // still "work" afterwards, just against the wrong text. Bookmarking
      // both edges with temporary marker elements (which never merge,
      // unlike text nodes) survives that and lets the range be rebuilt
      // from their positions afterwards.
      const startMarker = document.createElement("span")
      const endMarker = document.createElement("span")
      const startRange = range.cloneRange()
      startRange.collapse(true)
      startRange.insertNode(startMarker)
      const endRange = range.cloneRange()
      endRange.collapse(false)
      endRange.insertNode(endMarker)

      overlapping.forEach(unwrapBoldElement)

      const rebuilt = document.createRange()
      rebuilt.setStartAfter(startMarker)
      rebuilt.setEndBefore(endMarker)
      startMarker.remove()
      endMarker.remove()
      workingRange = rebuilt
    }

    const strong = document.createElement("strong")
    try {
      workingRange.surroundContents(strong)
    } catch {
      const fragment = workingRange.extractContents()
      strong.appendChild(fragment)
      workingRange.insertNode(strong)
    }

    // Collapse to just after the bolded text rather than leaving it
    // selected. Keeping it selected meant a duplicate keydown (e.g. OS key
    // repeat firing twice for one press) would immediately re-enter this
    // function, detect the selection is now inside the <strong> just
    // created, and unwrap it again - bolding would silently no-op. A
    // collapsed selection makes the top-of-function isCollapsed guard
    // catch that case instead.
    selection.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(strong)
    newRange.collapse(false)
    selection.addRange(newRange)
  }

  /**
   * Saves whatever is currently being typed in the inline editor before an
   * action switches the active slide. Native blur alone isn't reliable here
   * (e.g. clicking a slide thumbnail button doesn't always move focus in
   * Safari), so this is called explicitly ahead of every activeSlideId
   * change instead of assuming onBlur already ran.
   */
  function commitActiveEdit() {
    if (!editingLayerId) return
    const layer = activeSlide.textLayers.find(
      (item) => item.id === editingLayerId
    )
    if (!layer || !inlineEditorRef.current) return
    finishInlineEditing(layer, serializeEditableNode(inlineEditorRef.current))
  }

  function addSlide() {
    commitActiveEdit()
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
    commitActiveEdit()
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

    commitActiveEdit()
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

  async function startNewProject() {
    const newProject = await createBlankProject()
    router.push(`/slideshow/${newProject.id}`)
  }

  function restoreStarter() {
    const shouldReplace = window.confirm(
      "Restore the three-slide starter? Your current project will be replaced."
    )
    if (!shouldReplace) return

    setProject({ ...cloneStarterProject(), id: project.id })
    setNotice("Starter slideshow restored.")
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file such as PNG, JPEG, or WebP.")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice("Choose an image smaller than 15 MB.")
      return
    }

    try {
      const { dataUrl } = await resizeImageToDataUrl(file)
      updateActiveSlide({
        image: { id: crypto.randomUUID(), name: file.name, dataUrl },
      })
      setNotice(`${file.name} added to slide ${activeIndex + 1}.`)
    } catch {
      setNotice("Could not process this image. Try again.")
    }
  }

  async function handleContentImageUpload(file: File | undefined) {
    if (!file || !project.productId) return
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file such as PNG, JPEG, or WebP.")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice("Choose an image smaller than 15 MB.")
      return
    }

    const productId = project.productId
    setIsUploadingContentImage(true)
    try {
      const { dataUrl } = await resizeImageToDataUrl(file)
      const product = await addProductContentImage(productId, {
        name: file.name,
        dataUrl,
      })
      setContentImages(product.contentImages ?? [])
      setNotice(`${file.name} added to this product's content images.`)
    } catch {
      setNotice("Could not add this image. Try again.")
    } finally {
      setIsUploadingContentImage(false)
    }
  }

  async function addContentImageOverlay(image: ProductContentImage) {
    try {
      const { width, height } = await getImageDimensions(image.dataUrl)
      addImageOverlay({
        name: image.name,
        dataUrl: image.dataUrl,
        rect: computeFitRect(width, height),
        naturalAspect: width / height,
      })
      setNotice(`${image.name} added to slide ${activeIndex + 1}.`)
    } catch {
      setNotice("Could not add this image. Try again.")
    }
  }

  async function handleImageOverlayUpload(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file such as PNG, JPEG, or WebP.")
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice("Choose an image smaller than 15 MB.")
      return
    }

    try {
      const { dataUrl, width, height } = await resizeImageToDataUrl(file)
      addImageOverlay({
        name: file.name,
        dataUrl,
        rect: computeFitRect(width, height),
        naturalAspect: width / height,
      })
      setNotice(`${file.name} added to slide ${activeIndex + 1}.`)
    } catch {
      setNotice("Could not process this image. Try again.")
    }
  }

  function removeContentImage(imageId: string) {
    if (!project.productId) return
    const productId = project.productId
    setContentImages((current) =>
      current.filter((image) => image.id !== imageId)
    )
    void removeProductContentImage(productId, imageId).catch(() => {
      setNotice("Could not remove that image. Try again.")
    })
  }

  async function autoFillMissingImages() {
    setIsAutoFillingImages(true)
    setNotice(null)
    try {
      const result = await autoFillSlideImages(project.slides)
      if (result.filledCount > 0) {
        updateProject((current) => ({ ...current, slides: result.slides }))
      }

      setNotice(
        result.filledCount === 0
          ? "No matching photos were found. Try again."
          : `${result.filledCount} ${result.filledCount === 1 ? "slide" : "slides"} filled${result.failedCount ? `; ${result.failedCount} could not be matched` : ""}.`
      )
    } catch (searchError) {
      setNotice(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while finding images."
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
          <Link
            href="/"
            aria-label="Back to slideshows"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:border-black/20 hover:text-black"
          >
            <ArrowLeft className="size-4.5" aria-hidden="true" />
          </Link>
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
            {saveState === "saved" ? "Saved" : null}
            {saveState === "failed" ? "Not saved" : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={saveState === "saving"}
            onClick={() => void saveNow()}
          >
            {saveState === "saving" ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">Save</span>
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
          <Button size="sm" onClick={() => void startNewProject()}>
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
                      onClick={() => {
                        commitActiveEdit()
                        updateProject((current) => ({
                          ...current,
                          activeSlideId: slide.id,
                        }))
                      }}
                      className={cn(
                        "group relative w-full rounded-xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                        slide.id === project.activeSlideId
                          ? "border-[#4758c7] bg-white shadow-[0_8px_24px_rgba(42,43,55,.09)]"
                          : "border-black/10 bg-white/45 hover:bg-white/75"
                      )}
                    >
                      <span
                        className="relative block aspect-[9/12] overflow-hidden"
                        style={{
                          background:
                            slide.backgroundColor ?? activeTheme.background,
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
                                  <RichText value={layer.text} />
                                </span>
                              </span>
                            )
                        )}
                        {(slide.imageLayers ?? []).map((layer) => (
                          <span
                            key={layer.id}
                            className="absolute z-20 block overflow-hidden"
                            style={{
                              left: `${layer.rect.x}%`,
                              top: `${layer.rect.y}%`,
                              width: `${layer.rect.width}%`,
                              height: `${layer.rect.height}%`,
                            }}
                          >
                            <img
                              src={layer.dataUrl}
                              alt=""
                              className="size-full object-cover"
                              style={{
                                transform: `scale(${layer.imageScale})`,
                              }}
                            />
                          </span>
                        ))}
                        {(slide.notificationLayers ?? []).map((layer) => (
                          <span
                            key={layer.id}
                            className="absolute z-30 block"
                            style={{
                              left: `${layer.x}%`,
                              top: `${layer.y}%`,
                              width: `${layer.width}%`,
                            }}
                          >
                            <NotificationCard layer={layer} />
                          </span>
                        ))}
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
            <button
              type="button"
              disabled={!navDeleteTarget}
              aria-label={
                !navDeleteTarget
                  ? "Nothing to delete"
                  : navDeleteTarget.kind === "image"
                    ? "Remove image"
                    : navDeleteTarget.kind === "overlay"
                      ? `Delete ${navDeleteTarget.layer.name.toLowerCase()}`
                      : navDeleteTarget.kind === "notification"
                        ? "Delete notification"
                        : navDeleteTarget.layer.visible
                          ? `Delete ${navDeleteTarget.layer.name.toLowerCase()} layer`
                          : `Restore ${navDeleteTarget.layer.name.toLowerCase()} layer`
              }
              title={
                navDeleteTarget?.kind === "image"
                  ? "Remove image"
                  : navDeleteTarget?.kind === "overlay"
                    ? "Delete this image"
                    : navDeleteTarget?.kind === "notification"
                      ? "Delete this notification"
                      : navDeleteTarget?.kind === "layer"
                        ? navDeleteTarget.layer.visible
                          ? "Delete this text box"
                          : "Restore this text box"
                        : undefined
              }
              onClick={handleNavDelete}
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7] disabled:pointer-events-none disabled:opacity-30",
                navDeleteTarget?.kind === "layer" &&
                  !navDeleteTarget.layer.visible
                  ? "border-[#4758c7]/30 bg-[#eef0ff] text-[#4758c7]"
                  : "border-black/10 bg-white text-black/45 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              )}
            >
              {navDeleteTarget?.kind === "layer" &&
              !navDeleteTarget.layer.visible ? (
                <Eye className="size-3.5" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </button>
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
              className="relative aspect-[9/16] max-h-[68svh] w-full max-w-96 overflow-hidden shadow-[0_28px_70px_rgba(35,36,47,.22)] ring-1 ring-black/10"
              style={{
                background:
                  activeSlide.backgroundColor ?? activeTheme.background,
                containerType: "inline-size",
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const payload = event.dataTransfer.getData("application/json")
                if (!payload) return

                let image: { name?: unknown; dataUrl?: unknown }
                try {
                  image = JSON.parse(payload)
                } catch {
                  return
                }
                if (
                  typeof image.name !== "string" ||
                  typeof image.dataUrl !== "string"
                ) {
                  return
                }

                const canvasRect = event.currentTarget.getBoundingClientRect()
                const centerX =
                  ((event.clientX - canvasRect.left) / canvasRect.width) * 100
                const centerY =
                  ((event.clientY - canvasRect.top) / canvasRect.height) * 100
                const name = image.name
                const dataUrl = image.dataUrl

                void getImageDimensions(dataUrl)
                  .then(({ width, height }) => {
                    const percentAspect =
                      width / height / CANVAS_ASPECT_RATIO
                    const fitted = computeAspectFitRect(
                      percentAspect,
                      30,
                      MIN_IMAGE_LAYER_SIZE
                    )
                    addImageOverlay({
                      name,
                      dataUrl,
                      rect: {
                        x: clamp(
                          centerX - fitted.width / 2,
                          0,
                          100 - fitted.width
                        ),
                        y: clamp(
                          centerY - fitted.height / 2,
                          0,
                          100 - fitted.height
                        ),
                        width: fitted.width,
                        height: fitted.height,
                      },
                      naturalAspect: width / height,
                    })
                  })
                  .catch(() => {
                    setNotice("Could not add this image. Try again.")
                  })
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
                      pendingCaretPointRef.current = {
                        x: event.clientX,
                        y: event.clientY,
                      }
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
                        // toggleBoldSelection mutates this element's DOM
                        // directly (inserting/removing a real <strong>).
                        // While editing, content is set via
                        // dangerouslySetInnerHTML (once, at mount) instead
                        // of React-controlled children, so React treats
                        // this subtree as opaque and never tries to diff it
                        // against a stale record - without that, any
                        // unrelated re-render (e.g. autosave) while editing
                        // could make React "fix" the DOM back to what it
                        // last rendered, silently undoing the bold. The key
                        // forces a full remount at the editing/not-editing
                        // transition, since React errors if the same
                        // element switches between dangerouslySetInnerHTML
                        // and children without one - a patch attempt there
                        // previously crashed the page.
                        key={isEditing ? `${layer.id}-editing` : layer.id}
                        ref={isEditing ? inlineEditorRef : undefined}
                        className="block min-h-[1em] w-full whitespace-pre-wrap outline-none"
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
                            serializeEditableNode(event.currentTarget)
                          )
                        }
                        onKeyDown={(event) => {
                          // Escape used to also discard whatever was typed
                          // and restore the pre-edit text before blurring -
                          // silently, with no confirmation. Reaching for
                          // Escape to just get out of a text field is a
                          // near-universal reflex, so that made it a data
                          // loss trap. It now exits the same way clicking
                          // away or Cmd/Ctrl+Enter already do: save and
                          // finish editing, nothing discarded.
                          if (event.key === "Escape") {
                            event.currentTarget.blur()
                          }
                          if (
                            event.key === "Enter" &&
                            (event.metaKey || event.ctrlKey)
                          ) {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key.toLowerCase() === "b"
                          ) {
                            event.preventDefault()
                            // Holding the keys briefly can fire multiple
                            // keydown events (OS key repeat) for one press;
                            // only toggle on the first.
                            if (!event.repeat) toggleBoldSelection()
                          }
                        }}
                        {...(isEditing
                          ? {
                              dangerouslySetInnerHTML: {
                                __html: layer.text
                                  ? richTextToHtml(layer.text)
                                  : `Add ${layer.name.toLowerCase()} text`,
                              },
                            }
                          : {
                              children: layer.text ? (
                                <RichText value={layer.text} />
                              ) : (
                                `Add ${layer.name.toLowerCase()} text`
                              ),
                            })}
                      />
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
              {(activeSlide.imageLayers ?? []).map((layer) => {
                const isSelected = selectedImageLayerId === layer.id
                return (
                  <div
                    key={layer.id}
                    className={cn(
                      "group absolute z-20 touch-none",
                      layer.locked ? "cursor-default" : "cursor-move",
                      isSelected &&
                        "outline-2 outline-offset-2 outline-[#4758c7]"
                    )}
                    style={{
                      left: `${layer.rect.x}%`,
                      top: `${layer.rect.y}%`,
                      width: `${layer.rect.width}%`,
                      height: `${layer.rect.height}%`,
                    }}
                    onPointerDown={(event) =>
                      startImageLayerInteraction(event, layer, "drag")
                    }
                    onPointerMove={moveImageLayerInteraction}
                    onPointerUp={finishImageLayerInteraction}
                    onPointerCancel={finishImageLayerInteraction}
                  >
                    <div className="size-full overflow-hidden">
                      <img
                        src={layer.dataUrl}
                        alt=""
                        draggable={false}
                        className="size-full object-cover"
                        style={{ transform: `scale(${layer.imageScale})` }}
                      />
                    </div>
                    {isSelected && !layer.locked && (
                      <>
                        <button
                          type="button"
                          aria-label={`Make ${layer.name} as large as possible without cropping it`}
                          title="Maximize without cropping"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() =>
                            updateImageLayer(layer.id, {
                              rect: computeMaxFitRect(layer.naturalAspect),
                            })
                          }
                          className="absolute -top-2 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-[#4758c7] text-white shadow-sm"
                        >
                          <Maximize2 className="size-2.5" />
                        </button>
                        {(
                          [
                            {
                              corner: "nw",
                              position: "-top-2 -left-2",
                              cursor: "cursor-nwse-resize",
                            },
                            {
                              corner: "ne",
                              position: "-top-2 -right-2",
                              cursor: "cursor-nesw-resize",
                            },
                            {
                              corner: "sw",
                              position: "-bottom-2 -left-2",
                              cursor: "cursor-nesw-resize",
                            },
                            {
                              corner: "se",
                              position: "-bottom-2 -right-2",
                              cursor: "cursor-nwse-resize",
                            },
                          ] as const
                        ).map(({ corner, position, cursor }) => (
                          <button
                            key={corner}
                            type="button"
                            aria-label={`Resize ${layer.name} from the ${corner} corner`}
                            className={cn(
                              "absolute size-4 rounded-full border-2 border-[#4758c7] bg-white shadow-sm",
                              position,
                              cursor
                            )}
                            onPointerDown={(event) =>
                              startImageLayerInteraction(event, layer, corner)
                            }
                            onPointerMove={(event) => {
                              event.stopPropagation()
                              moveImageLayerInteraction(event)
                            }}
                            onPointerUp={(event) => {
                              event.stopPropagation()
                              finishImageLayerInteraction(event)
                            }}
                            onPointerCancel={(event) => {
                              event.stopPropagation()
                              finishImageLayerInteraction(event)
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
              {(activeSlide.notificationLayers ?? []).map((layer) => {
                const isSelected = selectedNotificationLayerId === layer.id
                return (
                  <div
                    key={layer.id}
                    className={cn(
                      "absolute z-30 touch-none",
                      layer.locked ? "cursor-default" : "cursor-move",
                      isSelected &&
                        "outline-2 outline-offset-2 outline-[#4758c7]"
                    )}
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.width}%`,
                    }}
                    onPointerDown={(event) =>
                      startNotificationInteraction(event, layer)
                    }
                    onPointerMove={moveNotificationInteraction}
                    onPointerUp={finishNotificationInteraction}
                    onPointerCancel={finishNotificationInteraction}
                  >
                    <NotificationCard layer={layer} />
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
                Changes save automatically. AI rewrites stay fully editable.
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
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={addTextBox}
              >
                <Plus data-icon="inline-start" />
                Add text box
              </Button>
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={addNotificationOverlay}
              >
                <Plus data-icon="inline-start" />
                Add notification
              </Button>
              <p className="mt-2 text-[10px] leading-relaxed text-black/40">
                Select a text box and press Cmd/Ctrl+C, then Cmd/Ctrl+V to copy
                it, even onto another slide.
              </p>
            </div>

            <fieldset className="mb-6">
              <legend className="mb-3 text-xs font-semibold text-black/60">
                Background
              </legend>
              <div className="flex gap-2">
                {(
                  [
                    {
                      label: "Theme",
                      value: null,
                      swatch: activeTheme.background,
                    },
                    { label: "Black", value: "#000000", swatch: "#000000" },
                    { label: "White", value: "#ffffff", swatch: "#ffffff" },
                  ] as const
                ).map((option) => {
                  const selected =
                    (activeSlide.backgroundColor ?? null) === option.value

                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={selected}
                      title={option.label}
                      onClick={() =>
                        updateActiveSlide({ backgroundColor: option.value })
                      }
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                        selected
                          ? "border-[#4758c7] bg-[#eef0ff]"
                          : "border-black/10 bg-white hover:border-black/20"
                      )}
                    >
                      <span
                        className="size-6 rounded-full border border-black/10"
                        style={{ background: option.swatch }}
                      />
                      <span className="text-[10px] font-medium text-black/60">
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="mb-6">
              <legend className="mb-3 text-xs font-semibold text-black/60">
                Text style
              </legend>
              <Select
                value={appliedTextStyle ?? undefined}
                onValueChange={(value) => selectTextStyle(value as TextStyleId)}
              >
                <SelectTrigger className="h-auto w-full justify-between rounded-xl border-black/10 bg-white px-3 py-2.5 hover:border-black/20 focus-visible:border-[#4758c7] focus-visible:ring-[#4758c7]/10">
                  <SelectValue placeholder="Mixed styles">
                    {(value: TextStyleId | null) => {
                      const textStyle = textStyles.find(
                        (style) => style.id === value
                      )
                      return (
                        <span className="flex items-center gap-2.5">
                          {textStyle && (
                            <TextStyleSwatch
                              textStyleId={textStyle.id}
                              size="sm"
                            />
                          )}
                          <span className="text-sm font-medium">
                            {textStyle?.name ?? "Mixed styles"}
                          </span>
                        </span>
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-black/10">
                  {textStyles.map((textStyle) => (
                    <SelectItem
                      key={textStyle.id}
                      value={textStyle.id}
                      className="focus:bg-[#eef0ff] focus:text-[#4758c7] data-[highlighted]:bg-[#eef0ff] data-[highlighted]:text-[#4758c7]"
                    >
                      <span className="flex items-center gap-2.5">
                        <TextStyleSwatch textStyleId={textStyle.id} />
                        <span className="text-sm font-medium">
                          {textStyle.name}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </fieldset>

            {selectedLayer && selectedFont && (
              <fieldset className="mb-6">
                <legend className="sr-only">Selected text layer</legend>
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

            {selectedImageLayer && !selectedImageLayer.locked && (
              <fieldset className="mb-6 rounded-xl border border-black/10 bg-white p-3">
                <legend className="mb-1 px-1 text-[11px] font-medium text-black/50">
                  Selected image
                </legend>
                <EditorRange
                  label="Zoom"
                  value={selectedImageLayer.imageScale}
                  display={`${Math.round(selectedImageLayer.imageScale * 100)}%`}
                  min={1}
                  max={3}
                  step={0.05}
                  onChange={(imageScale) =>
                    updateImageLayer(selectedImageLayer.id, { imageScale })
                  }
                />
                <p className="mt-2 text-[10px] leading-relaxed text-black/40">
                  Scales the image up within its current box - the box itself
                  stays the same size.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() =>
                    updateImageLayer(selectedImageLayer.id, {
                      rect: { x: 0, y: 0, width: 100, height: 100 },
                    })
                  }
                >
                  <Maximize2 data-icon="inline-start" />
                  Fill entire slide
                </Button>
                <p className="mt-1.5 text-[10px] leading-relaxed text-black/40">
                  Stretches the box edge to edge - crops the image if its shape
                  doesn&apos;t match the slide. The corner handles and the{" "}
                  <Maximize2 className="inline size-3 align-[-1px]" /> button on
                  the canvas resize without ever cropping instead.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeImageOverlay(selectedImageLayer.id)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete image
                </Button>
                <p className="mt-1.5 text-[10px] leading-relaxed text-black/40">
                  Or press Delete/Backspace with it selected.
                </p>
              </fieldset>
            )}

            {selectedNotificationLayer && !selectedNotificationLayer.locked && (
              <fieldset className="mb-6 rounded-xl border border-black/10 bg-white p-3">
                <legend className="mb-1 px-1 text-[11px] font-medium text-black/50">
                  Selected notification
                </legend>

                <input
                  ref={notificationIconInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    handleNotificationIconUpload(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label="Change app icon"
                    title="Change app icon"
                    onClick={() => notificationIconInputRef.current?.click()}
                    className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-black/10 bg-[#f6f5f2] text-sm font-bold text-black/40 transition hover:border-black/25"
                  >
                    {selectedNotificationLayer.appIconDataUrl ? (
                      <img
                        src={selectedNotificationLayer.appIconDataUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      (selectedNotificationLayer.appName || "A")
                        .slice(0, 1)
                        .toUpperCase()
                    )}
                  </button>
                  <label className="block min-w-0 flex-1">
                    <span className="mb-1 block text-[10px] font-semibold text-black/50">
                      App or sender
                    </span>
                    <input
                      type="text"
                      value={selectedNotificationLayer.appName}
                      maxLength={30}
                      onChange={(event) =>
                        updateNotificationLayer(selectedNotificationLayer.id, {
                          appName: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                    />
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-semibold text-black/50">
                    Message
                  </span>
                  <textarea
                    value={selectedNotificationLayer.message}
                    maxLength={200}
                    rows={3}
                    onChange={(event) =>
                      updateNotificationLayer(selectedNotificationLayer.id, {
                        message: event.target.value,
                      })
                    }
                    className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-semibold text-black/50">
                    Time label
                  </span>
                  <input
                    type="text"
                    value={selectedNotificationLayer.timeLabel}
                    maxLength={20}
                    placeholder="now, 2m ago, Yesterday…"
                    onChange={(event) =>
                      updateNotificationLayer(selectedNotificationLayer.id, {
                        timeLabel: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                  />
                </label>

                <EditorRange
                  label="Width"
                  value={selectedNotificationLayer.width}
                  display={`${Math.round(selectedNotificationLayer.width)}%`}
                  min={40}
                  max={94}
                  step={1}
                  onChange={(width) =>
                    updateNotificationLayer(selectedNotificationLayer.id, {
                      width: clamp(
                        width,
                        40,
                        100 - selectedNotificationLayer.x
                      ),
                    })
                  }
                />

                <Button
                  variant="outline"
                  className="mt-3 w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    removeNotificationLayer(selectedNotificationLayer.id)
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  Delete notification
                </Button>
                <p className="mt-1.5 text-[10px] leading-relaxed text-black/40">
                  Or press Delete/Backspace with it selected.
                </p>
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
                  void handleImageUpload(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              <div className="space-y-2">
                <Button
                  className="w-full bg-[#4758c7] text-white hover:bg-[#3e4db0]"
                  onClick={() => setImageSearchOpen(true)}
                >
                  <Search data-icon="inline-start" />
                  Search Pinterest
                </Button>
                <Button
                  className="w-full bg-[#4758c7] text-white hover:bg-[#3e4db0]"
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
                  className="w-full bg-[#4758c7] text-white hover:bg-[#3e4db0]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus data-icon="inline-start" />
                  {activeSlide.image ? "Upload replacement" : "Upload image"}
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold text-black/60">
                Content
              </p>

              <input
                ref={overlayImageInputRef}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  void handleImageOverlayUpload(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              <Button
                variant="outline"
                className="mb-1.5 w-full"
                onClick={() => overlayImageInputRef.current?.click()}
              >
                <ImagePlus data-icon="inline-start" />
                Add image overlay
              </Button>
              <p className="mb-4 text-[10px] leading-relaxed text-black/40">
                Adds this image as a draggable, resizable layer on this slide
                only, shown in full and never cropped. No product required.
              </p>

              {!project.productId ? (
                <p className="rounded-xl border border-dashed border-black/15 px-3 py-2.5 text-[11px] leading-relaxed text-black/40">
                  Link a product when composing a slideshow to save reusable
                  content images here.
                </p>
              ) : (
                <>
                  <input
                    ref={contentImageInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => {
                      void handleContentImageUpload(event.target.files?.[0])
                      event.target.value = ""
                    }}
                  />
                  {contentImages.length > 0 && (
                    <div className="mb-2 grid grid-cols-3 gap-2">
                      {contentImages.map((image) => (
                        <div key={image.id} className="group relative">
                          <button
                            type="button"
                            draggable
                            aria-label={`Drag ${image.name} onto the canvas`}
                            title="Drag onto the canvas, or click to add"
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                "application/json",
                                JSON.stringify({
                                  name: image.name,
                                  dataUrl: image.dataUrl,
                                })
                              )
                              event.dataTransfer.effectAllowed = "copy"
                            }}
                            onClick={() => void addContentImageOverlay(image)}
                            className="aspect-square w-full cursor-grab overflow-hidden rounded-lg bg-cover bg-center ring-1 ring-black/10 transition hover:ring-[#4758c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7] active:cursor-grabbing"
                            style={{
                              backgroundImage: `url(${JSON.stringify(image.dataUrl)})`,
                            }}
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${image.name}`}
                            onClick={() => removeContentImage(image.id)}
                            className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isUploadingContentImage}
                    onClick={() => contentImageInputRef.current?.click()}
                  >
                    {isUploadingContentImage ? (
                      <LoaderCircle
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <ImagePlus data-icon="inline-start" />
                    )}
                    Add content image
                  </Button>
                </>
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

      <ImageSearchDialog
        open={imageSearchOpen}
        onClose={() => setImageSearchOpen(false)}
        onSelect={(image) => {
          updateActiveSlide({ image })
          setNotice(`Photo added to slide ${activeIndex + 1}.`)
        }}
      />
    </main>
  )
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

function RichText({ value }: { value: string }) {
  return (
    <>
      {parseRichText(value).map((segment, index) =>
        segment.bold ? (
          <strong key={index}>{segment.text}</strong>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function NotificationCard({ layer }: { layer: NotificationOverlay }) {
  return (
    <div
      className="text-white backdrop-blur-xl"
      style={{
        borderRadius: "5cqw",
        background: "rgba(20,20,20,.5)",
        padding: "3cqw 3.4cqw",
        boxShadow: "0 1.2cqw 3cqw rgba(0,0,0,.3)",
      }}
    >
      <div className="flex items-center" style={{ gap: "2.4cqw" }}>
        {layer.appIconDataUrl ? (
          <img
            src={layer.appIconDataUrl}
            alt=""
            className="shrink-0 object-cover"
            style={{
              width: "7.6cqw",
              height: "7.6cqw",
              borderRadius: "1.8cqw",
            }}
          />
        ) : (
          <div
            className="grid shrink-0 place-items-center bg-white/20 font-bold"
            style={{
              width: "7.6cqw",
              height: "7.6cqw",
              borderRadius: "1.8cqw",
              fontSize: "3.2cqw",
            }}
          >
            {(layer.appName || "A").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: "2cqw" }}>
            <span
              className="flex-1 truncate font-semibold"
              style={{ fontSize: "3.4cqw" }}
            >
              {layer.appName || "App"}
            </span>
            <span
              className="shrink-0 text-white/55"
              style={{ fontSize: "2.85cqw" }}
            >
              {layer.timeLabel}
            </span>
          </div>
          <p
            className="text-pretty text-white/90"
            style={{
              fontSize: "3.15cqw",
              marginTop: "1cqw",
              lineHeight: 1.35,
            }}
          >
            {layer.message}
          </p>
        </div>
      </div>
    </div>
  )
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

export function SlideExportCard({
  slide,
  theme,
}: {
  slide: SlideshowSlide
  theme: SlideshowTheme
}) {
  return (
    <div
      className="relative size-full overflow-hidden"
      style={{
        background: slide.backgroundColor ?? theme.background,
        containerType: "inline-size",
      }}
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
              <span style={getTextLayerContentStyle(layer)}>
                <RichText value={layer.text} />
              </span>
            </div>
          )
      )}
      {(slide.imageLayers ?? []).map((layer) => (
        <div
          key={layer.id}
          className="absolute z-20 overflow-hidden"
          style={{
            left: `${layer.rect.x}%`,
            top: `${layer.rect.y}%`,
            width: `${layer.rect.width}%`,
            height: `${layer.rect.height}%`,
          }}
        >
          <img
            src={layer.dataUrl}
            alt=""
            className="size-full object-cover"
            style={{ transform: `scale(${layer.imageScale})` }}
          />
        </div>
      ))}
      {(slide.notificationLayers ?? []).map((layer) => (
        <div
          key={layer.id}
          className="absolute z-30"
          style={{
            left: `${layer.x}%`,
            top: `${layer.y}%`,
            width: `${layer.width}%`,
          }}
        >
          <NotificationCard layer={layer} />
        </div>
      ))}
    </div>
  )
}

/**
 * Remote image hosts we don't control (Pinterest's CDN in particular) send
 * no CORS headers, which taints the export canvas and produces a blank
 * image. Routing through our own same-origin proxy avoids that; already
 * same-origin data: URIs (uploaded files) are left as-is.
 */
function toExportImageSrc(url: string): string {
  if (url.startsWith("data:")) return url
  return `/api/images/proxy?url=${encodeURIComponent(url)}`
}

async function renderSlideToBlob(
  slide: SlideshowSlide,
  theme: SlideshowTheme
): Promise<Blob | null> {
  const exportSlide: SlideshowSlide = slide.image
    ? {
        ...slide,
        image: {
          ...slide.image,
          dataUrl: toExportImageSrc(slide.image.dataUrl),
        },
      }
    : slide

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
      root.render(<SlideExportCard slide={exportSlide} theme={theme} />)
    })

    return await toBlob(container, {
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      pixelRatio: 1,
      // html-to-image's image-embed cache strips query params by default,
      // so every /api/images/proxy?url=... request collapsed onto the same
      // cache key and reused whichever image loaded first.
      includeQueryParams: true,
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

/**
 * Resolves a screen point to a collapsed selection range, so a double-click
 * that just triggered a remount (see the useEffect above) can put the
 * cursor back where the click actually landed instead of losing that
 * position. Returns null if the point doesn't land inside `root` (or the
 * browser can't resolve it), so the caller can fall back to selecting all.
 */
function getCaretRangeFromPoint(
  x: number,
  y: number,
  root: HTMLElement
): Range | null {
  type LegacyCaretDocument = Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null
  }
  const doc = root.ownerDocument as LegacyCaretDocument

  let range: Range | null = null
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(x, y)
  } else if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    if (position) {
      range = document.createRange()
      range.setStart(position.offsetNode, position.offset)
      range.collapse(true)
    }
  }

  if (!range || !root.contains(range.startContainer)) return null
  return range
}

function getContentEditableCaretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null
  }
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return null

  const measuring = document.createRange()
  measuring.selectNodeContents(root)
  measuring.setEnd(range.startContainer, range.startOffset)
  return measuring.toString().length
}

/**
 * TEMPORARY diagnostic for the "cursor jumps backward while typing" report -
 * two prior fix attempts (deferring the autosave badge's state update, and a
 * synthetic stress test of the render pattern) failed to reproduce it, so
 * this logs full context to the console the moment a real jump happens in
 * someone's actual usage instead of shipping another unverified guess.
 * Remove once the root cause is confirmed and fixed.
 */
function installCursorJumpDiagnostics(): () => void {
  let lastElement: Element | null = null
  let lastOffset: number | null = null
  let lastAction = "none"
  let lastActionAt = 0

  function noteAction(action: string) {
    lastAction = action
    lastActionAt = performance.now()
  }

  function handleKeyDown(event: KeyboardEvent) {
    noteAction(`key:${event.key}`)
  }

  function handlePointerDown() {
    noteAction("pointerdown")
  }

  function handleSelectionChange() {
    const active = document.activeElement
    const isTextarea = active instanceof HTMLTextAreaElement
    const isEditableSpan =
      active instanceof HTMLElement && active.isContentEditable
    if (!active || (!isTextarea && !isEditableSpan)) {
      lastElement = null
      lastOffset = null
      return
    }

    const offset = isTextarea
      ? active.selectionStart
      : getContentEditableCaretOffset(active as HTMLElement)
    if (offset === null) return

    if (active === lastElement && lastOffset !== null && offset < lastOffset - 1) {
      const msSinceAction = performance.now() - lastActionAt
      // Any recent keydown or pointerdown - regardless of which key - means
      // the user themselves plausibly moved the caret (arrow keys, Home,
      // backspace-over-selection, clicking mid-text, etc.). What this is
      // actually hunting for is a jump with NO correlating input at all,
      // which is what "the cursor just moves on its own" would look like.
      const hadRecentUserAction = msSinceAction < 300

      if (!hadRecentUserAction) {
        const layerId =
          active instanceof HTMLElement
            ? (active.closest("[data-layer-id]") as HTMLElement | null)?.dataset
                .layerId
            : undefined
        console.warn("[cursor-jump] caret moved backward unexpectedly", {
          element: active,
          layerId,
          from: lastOffset,
          to: offset,
          lastAction,
          msSinceAction: Math.round(msSinceAction),
          textLength: isTextarea
            ? (active as HTMLTextAreaElement).value.length
            : active.textContent?.length,
        })
        console.trace("[cursor-jump] stack at detection")
      }
    }

    lastElement = active
    lastOffset = offset
  }

  document.addEventListener("selectionchange", handleSelectionChange)
  window.addEventListener("keydown", handleKeyDown, true)
  window.addEventListener("pointerdown", handlePointerDown, true)
  return () => {
    document.removeEventListener("selectionchange", handleSelectionChange)
    window.removeEventListener("keydown", handleKeyDown, true)
    window.removeEventListener("pointerdown", handlePointerDown, true)
  }
}

const MIN_IMAGE_LAYER_SIZE = 8
const CANVAS_ASPECT_RATIO = 9 / 16

const IMAGE_RESIZE_GROW_DIRECTION: Record<
  ImageResizeCorner,
  { x: number; y: number }
> = {
  se: { x: 1, y: 1 },
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
}

/**
 * Resizes an image overlay's rect from any of its four corners, anchoring
 * the opposite corner in place - e.g. dragging the top-left handle keeps
 * the bottom-right corner fixed and grows/shrinks toward it. Always keeps
 * the box's aspect ratio locked to the source image's own (naturalAspect,
 * converted into this rect's percent-of-canvas-width/height units) so
 * resizing only ever scales the image up or down - never crops it, since
 * overlays render with background-size: cover.
 */
const MAX_IMAGE_LAYER_SIZE = 400

function computeResizedRect(
  start: LayerRect,
  corner: ImageResizeCorner,
  deltaX: number,
  deltaY: number,
  naturalAspect: number
): LayerRect {
  const percentAspect = naturalAspect / CANVAS_ASPECT_RATIO
  const direction = IMAGE_RESIZE_GROW_DIRECTION[corner]
  const growAmount = deltaX * direction.x + deltaY * direction.y

  const anchorOnRight = corner === "nw" || corner === "sw"
  const anchorOnBottom = corner === "nw" || corner === "ne"
  const anchorX = anchorOnRight ? start.x + start.width : start.x
  const anchorY = anchorOnBottom ? start.y + start.height : start.y

  // No upper bound tied to the canvas edges - dragging past the border is
  // allowed, same as Canva. The canvas itself clips (overflow-hidden), so
  // growing past 100% just crops the excess visually instead of being
  // blocked. Aspect ratio still stays locked, so it scales, never distorts.
  const width = clamp(
    start.width + growAmount,
    MIN_IMAGE_LAYER_SIZE,
    MAX_IMAGE_LAYER_SIZE
  )
  const height = width / percentAspect

  return {
    x: anchorOnRight ? anchorX - width : anchorX,
    y: anchorOnBottom ? anchorY - height : anchorY,
    width,
    height,
  }
}

const MAX_UPLOADED_IMAGE_DIMENSION = 1440

/**
 * Downscales and recompresses an uploaded image before it's stored as a
 * data URL. Project data (including every image) is saved as a single
 * JSON blob through a server action, which has a request body size limit -
 * an unprocessed phone screenshot or camera photo can easily blow past
 * that on its own, so every upload path funnels through this first.
 */
type ResizedImage = { dataUrl: string; width: number; height: number }

function resizeImageToDataUrl(file: File): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(
        1,
        MAX_UPLOADED_IMAGE_DIMENSION / Math.max(image.width, image.height)
      )
      const width = Math.round(image.width * scale)
      const height = Math.round(image.height * scale)

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (!context) {
        reject(new Error("Could not process this image."))
        return
      }
      context.drawImage(image, 0, 0, width, height)

      // Basing this on file.type alone would keep every PNG (including a
      // fully-opaque phone screenshot, which is PNG by default) as lossless
      // PNG - that compresses far worse than JPEG on busy, detailed content
      // like a screenshot, undoing most of the size reduction from
      // downscaling. Only use PNG when the image actually has transparent
      // pixels to preserve.
      const dataUrl = canvasHasTransparency(context, width, height)
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.85)
      resolve({ dataUrl, width, height })
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not read this image."))
    }
    image.src = objectUrl
  })
}

/**
 * A product's content images only ever store {id, name, dataUrl} - unlike a
 * fresh upload, there's no width/height already in hand - so this measures
 * one on demand to build a rect that matches its real aspect ratio instead
 * of guessing, which is what let a wide image get cropped down to a square.
 */
function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error("Could not read this image."))
    image.src = dataUrl
  })
}

/**
 * Builds a rect matching a given percent-space aspect ratio, scaled to fit
 * within a maxSpan x maxSpan box and centered. Shared by computeFitRect
 * (the default box for a freshly added overlay) and computeMaxFitRect (the
 * "fill the whole slide" shortcut) - both need "as large as possible
 * without ever cropping the image," just with a different max span.
 */
function computeAspectFitRect(
  percentAspect: number,
  maxSpan: number,
  minSpan: number
): LayerRect {
  let width = maxSpan
  let height = maxSpan / percentAspect
  if (height > maxSpan) {
    height = maxSpan
    width = maxSpan * percentAspect
  }

  // Scale both dimensions together, never independently - clamping just one
  // to minSpan (e.g. a very wide banner-shaped image) would distort the
  // aspect ratio and crop the image, breaking the "never crop" guarantee
  // this function exists to provide. Overshooting maxSpan here is fine:
  // resizing already tolerates layers far larger than the canvas.
  const scaleToMinSpan = Math.max(1, minSpan / width, minSpan / height)
  width *= scaleToMinSpan
  height *= scaleToMinSpan

  return {
    x: (100 - width) / 2,
    y: (100 - height) / 2,
    width,
    height,
  }
}

/**
 * A default overlay box that matches the image's own aspect ratio, scaled
 * to fit within the canvas with margin on every side - so a freshly added
 * overlay shows the whole image uncropped and smaller than the canvas,
 * the way dropping a photo onto a Canva page does, instead of immediately
 * cropping it to fit some arbitrary fixed box shape.
 */
function computeFitRect(imageWidth: number, imageHeight: number): LayerRect {
  const percentAspect = imageWidth / imageHeight / CANVAS_ASPECT_RATIO
  return computeAspectFitRect(percentAspect, 82, 20)
}

/**
 * The largest box that fits the image's aspect ratio inside the full
 * canvas without cropping - one dimension touches the edge, the other
 * gets margin if the ratios don't match exactly.
 */
function computeMaxFitRect(naturalAspect: number): LayerRect {
  const percentAspect = naturalAspect / CANVAS_ASPECT_RATIO
  return computeAspectFitRect(percentAspect, 100, MIN_IMAGE_LAYER_SIZE)
}

function canvasHasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  const { data } = context.getImageData(0, 0, width, height)
  for (let index = 3; index < data.length; index += 4) {
    if (data[index]! < 255) return true
  }
  return false
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

function TextStyleSwatch({
  textStyleId,
  size = "md",
}: {
  textStyleId: TextStyleId
  size?: "sm" | "md"
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(145deg,#8e8478,#3f453d)] ring-1 ring-black/10",
        size === "sm" ? "size-7" : "size-10"
      )}
    >
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
