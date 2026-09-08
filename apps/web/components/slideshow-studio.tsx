"use client"

import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  Layers3,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  createProject,
  createSlide,
  getTextLayer,
  getTextShadow,
  loadSlideshowProject,
  resolveLayerColor,
  slideshowThemes,
  starterProject,
  type SlideshowProject,
  type SlideshowSlide,
  type SlideshowTheme,
  type TextLayer,
  type ThemeId,
} from "@/lib/slideshow"

const STORAGE_KEY = "slides-auto.phase-one-project"

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function addSlide() {
    updateProject((current) => {
      const nextSlide = createSlide(current.slides.length + 1)
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

  function selectTheme(themeId: ThemeId) {
    updateProject((current) => ({ ...current, themeId }))
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

      <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[14rem_minmax(0,1fr)_19rem]">
        <aside className="border-b border-black/10 bg-[#f3f1ed] p-4 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Slides</h2>
            <span className="text-xs text-black/45 tabular-nums">
              {project.slides.length}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 lg:max-h-[calc(100svh-10rem)] lg:flex-col lg:overflow-y-auto lg:pr-1">
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
                    <span className="mb-2 block text-[11px] font-semibold text-black/45 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="relative block aspect-[9/12] overflow-hidden rounded-lg"
                      style={{ background: activeTheme.background }}
                    >
                      {slide.image && (
                        <span
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${JSON.stringify(slide.image.dataUrl)})`,
                          }}
                        />
                      )}
                      <span
                        className="absolute inset-x-2 bottom-2 line-clamp-3 text-[8px] leading-tight font-semibold"
                        style={{ color: activeTheme.foreground }}
                      >
                        {getTextLayer(slide, "hook")?.text ?? "Untitled slide"}
                      </span>
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
              <div
                className="absolute inset-0"
                style={{ background: activeTheme.wash }}
              />
              {activeSlide.textLayers.map(
                (layer) =>
                  layer.visible && (
                    <div
                      key={layer.id}
                      className="absolute z-10 overflow-hidden text-pretty"
                      data-layer-id={layer.id}
                      data-layer-role={layer.role}
                      style={getTextLayerStyle(layer, activeTheme)}
                    >
                      {layer.text || `Add ${layer.name.toLowerCase()} text`}
                    </div>
                  )
              )}
              <div
                className="absolute top-[7%] left-[9%] text-[10px] font-semibold tracking-[0.12em]"
                style={{ color: activeTheme.muted }}
              >
                {String(activeIndex + 1).padStart(2, "0")} /{" "}
                {String(project.slides.length).padStart(2, "0")}
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="border-t border-black/10 bg-[#f8f7f4] p-5 lg:border-t-0 lg:border-l">
          <div className="mb-6">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="size-4 text-[#f06f5d]" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Slide setup</h2>
            </div>
            <p className="text-xs leading-relaxed text-black/45">
              Changes are saved in this browser. Prompt generation will use this
              same editable slide format later.
            </p>
          </div>

          <fieldset className="mb-6">
            <legend className="mb-3 text-xs font-semibold text-black/60">
              Theme
            </legend>
            <div className="space-y-2">
              {slideshowThemes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => selectTheme(theme.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                    theme.id === project.themeId
                      ? "border-[#4758c7] bg-[#eef0ff]"
                      : "border-black/10 bg-white hover:border-black/20"
                  )}
                >
                  <span
                    className="block size-10 shrink-0 rounded-lg ring-1 ring-black/10"
                    style={{ background: theme.preview }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">
                      {theme.name}
                    </span>
                    <span className="block truncate text-[11px] text-black/45">
                      {theme.description}
                    </span>
                  </span>
                  {theme.id === project.themeId && (
                    <Check className="size-4 text-[#4758c7]" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>

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
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus data-icon="inline-start" />
              {activeSlide.image ? "Replace image" : "Upload image"}
            </Button>
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
              <span className="mb-1.5 block text-xs font-semibold text-black/60">
                Headline
              </span>
              <textarea
                className="min-h-24 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm leading-relaxed transition outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                maxLength={120}
                value={hookLayer?.text ?? ""}
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
              <span className="mb-1.5 block text-xs font-semibold text-black/60">
                Supporting text
              </span>
              <textarea
                className="min-h-20 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm leading-relaxed transition outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                maxLength={180}
                value={bodyLayer?.text ?? ""}
                onChange={(event) =>
                  bodyLayer &&
                  updateTextLayer(bodyLayer.id, { text: event.target.value })
                }
              />
            </label>
          </div>
        </aside>
      </div>
    </main>
  )
}

function getTextLayerStyle(
  layer: TextLayer,
  theme: SlideshowTheme
): CSSProperties {
  const { rect, style } = layer
  const fontFamily = {
    sans: "var(--font-sans)",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "var(--font-mono)",
  }[style.fontFamily]

  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
    color: resolveLayerColor(style.color, theme),
    backgroundColor: style.backgroundColor ?? undefined,
    fontFamily,
    fontSize: `${style.fontSize}cqw`,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
    textAlign: style.align,
    textShadow: getTextShadow(style),
  }
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
