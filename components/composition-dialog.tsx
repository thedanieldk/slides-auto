"use client"

import {
  AlertTriangle,
  FileText,
  ImageIcon,
  LoaderCircle,
  WandSparkles,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  composeGeneratedSlideshow,
  composeScript,
  hasTextOverflowRisk,
  type CompositionResult,
} from "@/lib/composition"
import { generatedSlideshowSchema } from "@/lib/ai/slideshow-generation"
import { getTextLayer, slideLayouts, type SlideLayoutId } from "@/lib/slideshow"

type CompositionDialogProps = {
  open: boolean
  onClose: () => void
  onApply: (result: CompositionResult) => void
}

type ComposerMode = "ai" | "script"

export function CompositionDialog({
  open,
  onClose,
  onApply,
}: CompositionDialogProps) {
  const [script, setScript] = useState("")
  const [mode, setMode] = useState<ComposerMode>("ai")
  const [slideCount, setSlideCount] = useState(5)
  const [layoutId, setLayoutId] = useState<SlideLayoutId>("editorial")
  const [result, setResult] = useState<CompositionResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  async function buildPreview() {
    if (script.trim().length < 12) return

    if (mode === "script") {
      setResult(composeScript({ script, slideCount, layoutId }))
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "slideshow",
          prompt: script,
          slideCount,
          layoutId,
        }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}

      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "Claude could not generate the slideshow."
        )
      }

      const generated = generatedSlideshowSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("Claude returned an incomplete slideshow. Try again.")
      }

      setResult(composeGeneratedSlideshow(generated.data))
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating the slideshow."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  function updateScript(value: string) {
    setScript(value)
    setResult(null)
    setError(null)
  }

  function updateLayout(value: SlideLayoutId) {
    setLayoutId(value)
    setResult(null)
    setError(null)
  }

  function updateMode(value: ComposerMode) {
    setMode(value)
    setResult(null)
    setError(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#171821]/45 p-0 backdrop-blur-sm md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.18 }}
            className="flex max-h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[1.75rem] bg-[#f8f7f4] shadow-2xl md:max-h-[88svh] md:rounded-[1.75rem]"
          >
            <header className="flex items-start justify-between gap-5 border-b border-black/10 px-5 py-4 md:px-7 md:py-5">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <WandSparkles className="size-4.5 text-[#f06f5d]" />
                  <h2 id="composer-title" className="text-base font-semibold">
                    Create a slideshow
                  </h2>
                </div>
                <p className="max-w-xl text-xs leading-relaxed text-black/50">
                  Start with one idea and let Claude write it, or split copy you
                  already have into editable slides.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close composer"
                onClick={onClose}
                className="grid size-8 shrink-0 place-items-center rounded-full text-black/45 transition hover:bg-black/5 hover:text-black focus-visible:outline-2 focus-visible:outline-[#4758c7]"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.78fr)] lg:overflow-hidden">
              <div className="border-b border-black/10 p-5 md:p-7 lg:overflow-y-auto lg:border-r lg:border-b-0">
                <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/5 p-1">
                  {(
                    [
                      ["ai", "Write with AI"],
                      ["script", "Use my script"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateMode(value)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#4758c7]",
                        mode === value
                          ? "bg-white text-black shadow-sm"
                          : "text-black/45 hover:text-black/70"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="mb-6 block">
                  <span className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-black/60">
                    <span className="flex items-center gap-1.5">
                      {mode === "ai" ? (
                        <WandSparkles className="size-3.5" />
                      ) : (
                        <FileText className="size-3.5" />
                      )}
                      {mode === "ai"
                        ? "What is this about?"
                        : "Script or outline"}
                    </span>
                    <span className="font-normal text-black/35 tabular-nums">
                      {script.length}/{mode === "ai" ? 2000 : 4000}
                    </span>
                  </span>
                  <textarea
                    autoFocus
                    value={script}
                    maxLength={mode === "ai" ? 2000 : 4000}
                    onChange={(event) => updateScript(event.target.value)}
                    placeholder={
                      mode === "ai"
                        ? "I kept putting off the gym because I thought every workout had to be perfect. Write about what finally helped me stay consistent."
                        : "Why most morning routines fail.\n\nPeople try to change everything at once.\n\nStart with one action you can repeat..."
                    }
                    className="min-h-52 w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed transition outline-none placeholder:text-black/28 focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                  />
                </label>

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-black/60">
                      Number of slides
                    </p>
                    <output className="rounded-full bg-[#ebe9e4] px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {slideCount}
                    </output>
                  </div>
                  <input
                    aria-label="Number of slides"
                    type="range"
                    min="2"
                    max="10"
                    value={slideCount}
                    onChange={(event) => {
                      setSlideCount(Number(event.target.value))
                      setResult(null)
                    }}
                    className="w-full accent-[#4758c7]"
                  />
                  <div className="flex justify-between text-[10px] text-black/35">
                    <span>2</span>
                    <span>10</span>
                  </div>
                </div>

                <fieldset>
                  <legend className="mb-3 text-xs font-semibold text-black/60">
                    Layout template
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    {slideLayouts.map((layout) => (
                      <button
                        key={layout.id}
                        type="button"
                        onClick={() => updateLayout(layout.id)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                          layout.id === layoutId
                            ? "border-[#4758c7] bg-[#eef0ff]"
                            : "border-black/10 bg-white hover:border-black/20"
                        )}
                      >
                        <LayoutMiniature layoutId={layout.id} />
                        <span className="mt-2 block text-[11px] font-semibold">
                          {layout.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-black/40">
                          {layout.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {error && (
                  <p
                    className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <Button
                  className="mt-5 w-full"
                  disabled={script.trim().length < 12 || isGenerating}
                  onClick={() => void buildPreview()}
                >
                  {isGenerating ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <WandSparkles data-icon="inline-start" />
                  )}
                  {isGenerating
                    ? "Writing slides…"
                    : mode === "ai"
                      ? "Generate preview"
                      : "Build preview"}
                </Button>
              </div>

              <div className="flex min-h-80 flex-col bg-[#efede8] p-5 md:p-7 lg:overflow-hidden">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Composition preview
                    </h3>
                    <p className="text-[11px] text-black/40">
                      Review the split before replacing your slides.
                    </p>
                  </div>
                  {result && (
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-black/50">
                      {result.slides.length} slides
                    </span>
                  )}
                </div>

                {result ? (
                  <>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {result.slides.map((slide, index) => {
                        const hook = getTextLayer(slide, "hook")
                        const body = getTextLayer(slide, "body")
                        const overflowRisk = hasTextOverflowRisk(slide)

                        return (
                          <motion.article
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.025 }}
                            key={slide.id}
                            className="rounded-xl border border-black/8 bg-white p-3"
                          >
                            <div className="flex gap-3">
                              <span className="pt-0.5 text-[10px] font-semibold text-black/30 tabular-nums">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs leading-snug font-semibold">
                                  {hook?.text || "Untitled slide"}
                                </p>
                                {body?.text && (
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-black/48">
                                    {body.text}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-1 text-[9px] text-black/35">
                                  <ImageIcon className="size-3" />
                                  <span className="truncate">
                                    {slide.imageQuery}
                                  </span>
                                </div>
                              </div>
                              {overflowRisk && (
                                <AlertTriangle
                                  className="size-3.5 shrink-0 text-amber-600"
                                  aria-label="Text may need manual fitting"
                                />
                              )}
                            </div>
                          </motion.article>
                        )
                      })}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => onApply(result)}
                    >
                      Replace with {result.slides.length} slides
                    </Button>
                  </>
                ) : (
                  <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-black/12 bg-white/45 px-8 text-center">
                    <div>
                      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-white text-black/35 shadow-sm">
                        <WandSparkles className="size-4" />
                      </div>
                      <p className="text-xs font-semibold">No preview yet</p>
                      <p className="mt-1 max-w-52 text-[11px] leading-relaxed text-black/40">
                        {mode === "ai"
                          ? "Describe the story you want to tell, then Claude will draft the slides here."
                          : "Add at least a sentence, choose a layout, then build the composition."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function LayoutMiniature({ layoutId }: { layoutId: SlideLayoutId }) {
  return (
    <span className="relative block aspect-[9/6] overflow-hidden rounded-lg bg-gradient-to-br from-[#e8dfd0] to-[#a99c90] ring-1 ring-black/8">
      <span
        className={cn(
          "absolute block bg-[#292821]",
          layoutId === "editorial" && "right-[12%] bottom-[27%] left-[12%] h-2",
          layoutId === "centered" && "top-[34%] right-[18%] left-[18%] h-2",
          layoutId === "caption-card" &&
            "right-[8%] bottom-[18%] left-[8%] h-5 rounded bg-white/90"
        )}
      />
      <span
        className={cn(
          "absolute block h-1 bg-[#292821]/45",
          layoutId === "editorial" && "right-[28%] bottom-[17%] left-[12%]",
          layoutId === "centered" && "top-[58%] right-[28%] left-[28%]",
          layoutId === "caption-card" && "right-[30%] bottom-[9%] left-[11%]"
        )}
      />
    </span>
  )
}
