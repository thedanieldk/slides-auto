"use client"

import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileText,
  ImageIcon,
  LoaderCircle,
  WandSparkles,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProductProfilePicker } from "@/components/product-profile-picker"
import { cn } from "@/lib/utils"
import {
  composeGeneratedSlideshow,
  composeScript,
  hasTextOverflowRisk,
  type CompositionResult,
} from "@/lib/composition"
import {
  generatedConceptsSchema,
  generatedSlideshowSchema,
  type GeneratedConcept,
} from "@/lib/ai/slideshow-generation"
import { copyFormats, type CopyFormatId } from "@/lib/ai/copy-formats"
import { getTextLayer, textStyles, type TextStyleId } from "@/lib/slideshow"
import type { ProductProfile } from "@/lib/products/product-profile"

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
  const [copyFormatId, setCopyFormatId] = useState<CopyFormatId>("smart")
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(
    null
  )
  const [concepts, setConcepts] = useState<GeneratedConcept[]>([])
  const [selectedConceptIndex, setSelectedConceptIndex] = useState<
    number | null
  >(null)
  const [slideCount, setSlideCount] = useState(5)
  const [textStyleId, setTextStyleId] = useState<TextStyleId>("clean-white")
  const [result, setResult] = useState<CompositionResult | null>(null)
  const [generationStage, setGenerationStage] = useState<
    "concepts" | "slides" | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  async function generateConcepts() {
    if (!selectedProduct) return

    setGenerationStage("concepts")
    setError(null)
    setResult(null)
    setConcepts([])
    setSelectedConceptIndex(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "concepts",
          copyFormatId,
          product: toProductDraft(selectedProduct),
        }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}

      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "The AI service could not generate concepts."
        )
      }

      const generated = generatedConceptsSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("The generated concepts were incomplete. Try again.")
      }

      setConcepts(generated.data.concepts)
      setSelectedConceptIndex(0)
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating concepts."
      )
    } finally {
      setGenerationStage(null)
    }
  }

  async function generateSlideshow() {
    if (!selectedProduct || selectedConceptIndex === null) return
    const concept = concepts[selectedConceptIndex]
    if (!concept) return

    setGenerationStage("slides")
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "slideshow",
          concept,
          slideCount,
          layoutId: textStyleId,
          product: toProductDraft(selectedProduct),
        }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}

      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "The AI service could not generate the slideshow."
        )
      }

      const generated = generatedSlideshowSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("The generated slideshow was incomplete. Try again.")
      }

      setResult(
        composeGeneratedSlideshow({
          ...generated.data,
          slides: generated.data.slides.map((slide) => ({
            ...slide,
            layoutId: textStyleId,
          })),
        })
      )
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating the slideshow."
      )
    } finally {
      setGenerationStage(null)
    }
  }

  function buildScriptPreview() {
    if (script.trim().length < 12) return
    setResult(composeScript({ script, slideCount, layoutId: textStyleId }))
  }

  function updateScript(value: string) {
    setScript(value)
    setResult(null)
    setError(null)
  }

  function updateTextStyle(value: TextStyleId) {
    setTextStyleId(value)
    setResult(null)
    setError(null)
  }

  function updateMode(value: ComposerMode) {
    setMode(value)
    setConcepts([])
    setSelectedConceptIndex(null)
    setResult(null)
    setError(null)
  }

  function updateCopyFormat(value: CopyFormatId) {
    setCopyFormatId(value)
    setConcepts([])
    setSelectedConceptIndex(null)
    setResult(null)
    setError(null)
  }

  const updateProduct = useCallback((product: ProductProfile | null) => {
    setSelectedProduct(product)
    setConcepts([])
    setSelectedConceptIndex(null)
    setResult(null)
    setError(null)
  }, [])

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
                  Turn a saved product into three content directions, or split
                  copy you already have into editable slides.
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

                {mode === "script" && (
                  <label className="mb-6 block">
                    <span className="mb-2 flex items-center justify-between gap-4 text-xs font-semibold text-black/60">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5" />
                        Script or outline
                      </span>
                      <span className="font-normal text-black/35 tabular-nums">
                        {script.length}/4000
                      </span>
                    </span>
                    <textarea
                      autoFocus
                      value={script}
                      maxLength={4000}
                      onChange={(event) => updateScript(event.target.value)}
                      placeholder="Why most morning routines fail.\n\nPeople try to change everything at once.\n\nStart with one action you can repeat..."
                      className="min-h-52 w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-relaxed transition outline-none placeholder:text-black/28 focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                    />
                  </label>
                )}

                {mode === "ai" && (
                  <>
                    <ProductProfilePicker
                      value={selectedProduct}
                      onChange={updateProduct}
                    />

                    <fieldset className="mb-6">
                      <legend className="mb-3 text-xs font-semibold text-black/60">
                        Copy format
                      </legend>
                      <div className="space-y-2">
                        {copyFormats.map((format) => {
                          const selected = format.id === copyFormatId

                          return (
                            <button
                              key={format.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => updateCopyFormat(format.id)}
                              className={cn(
                                "group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                                selected
                                  ? "border-[#4758c7] bg-[#eef0ff]"
                                  : "border-black/10 bg-white hover:border-black/20"
                              )}
                            >
                              <FormatMarker
                                formatId={format.id}
                                selected={selected}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold">
                                    {format.name}
                                  </span>
                                  {selected && (
                                    <Check className="size-3.5 shrink-0 text-[#4758c7]" />
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-black/45">
                                  {format.description}
                                </span>
                                <span className="mt-1 block text-[10px] font-medium text-black/35">
                                  Product: {format.productRole}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  </>
                )}

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
                    Text style
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    {textStyles.map((textStyle) => (
                      <button
                        key={textStyle.id}
                        type="button"
                        onClick={() => updateTextStyle(textStyle.id)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                          textStyle.id === textStyleId
                            ? "border-[#4758c7] bg-[#eef0ff]"
                            : "border-black/10 bg-white hover:border-black/20"
                        )}
                      >
                        <TextStyleMiniature textStyleId={textStyle.id} />
                        <span className="mt-2 block text-[11px] font-semibold">
                          {textStyle.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-black/40">
                          {textStyle.description}
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
                  disabled={
                    generationStage !== null ||
                    (mode === "ai"
                      ? selectedProduct === null
                      : script.trim().length < 12)
                  }
                  onClick={() =>
                    mode === "ai"
                      ? void generateConcepts()
                      : buildScriptPreview()
                  }
                >
                  {generationStage === "concepts" ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <WandSparkles data-icon="inline-start" />
                  )}
                  {generationStage === "concepts"
                    ? "Finding directions…"
                    : mode === "ai"
                      ? concepts.length > 0
                        ? "Generate 3 new concepts"
                        : "Generate 3 concepts"
                      : "Build preview"}
                </Button>
                {mode === "ai" && !selectedProduct && (
                  <p className="mt-2 text-center text-[10px] leading-relaxed text-black/40">
                    Choose a saved product or add one from a link first.
                  </p>
                )}
              </div>

              <div className="flex min-h-80 flex-col bg-[#efede8] p-5 md:p-7 lg:overflow-hidden">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {mode === "ai" && !result
                        ? "Choose a direction"
                        : "Composition preview"}
                    </h3>
                    <p className="text-[11px] text-black/40">
                      {mode === "ai" && !result
                        ? "AI infers three angles from the product profile."
                        : "Review the split before replacing your slides."}
                    </p>
                  </div>
                  {result && mode === "ai" ? (
                    <button
                      type="button"
                      onClick={() => setResult(null)}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-black/50 transition hover:text-black focus-visible:outline-2 focus-visible:outline-[#4758c7]"
                    >
                      Back to concepts
                    </button>
                  ) : result ? (
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-black/50">
                      {result.slides.length} slides
                    </span>
                  ) : null}
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
                ) : mode === "ai" && concepts.length > 0 ? (
                  <>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                      {concepts.map((concept, index) => (
                        <ConceptOption
                          key={`${concept.hook}-${index}`}
                          concept={concept}
                          index={index}
                          selected={selectedConceptIndex === index}
                          onSelect={() => {
                            setSelectedConceptIndex(index)
                            setError(null)
                          }}
                        />
                      ))}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      disabled={
                        selectedConceptIndex === null ||
                        generationStage !== null
                      }
                      onClick={() => void generateSlideshow()}
                    >
                      {generationStage === "slides" ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <ChevronRight data-icon="inline-end" />
                      )}
                      {generationStage === "slides"
                        ? "Writing slides…"
                        : `Turn this into ${slideCount} slides`}
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
                          ? selectedProduct
                            ? "Generate concepts to see three different ways into this product's story."
                            : "Choose a product first. Its profile gives the generator enough context to find the angles."
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

function ConceptOption({
  concept,
  index,
  onSelect,
  selected,
}: {
  concept: GeneratedConcept
  index: number
  onSelect: () => void
  selected: boolean
}) {
  const formatName =
    copyFormats.find((format) => format.id === concept.copyFormatId)?.name ??
    "Slideshow list"

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-white p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
        selected
          ? "border-[#4758c7] shadow-[0_8px_24px_rgba(71,88,199,.12)]"
          : "border-black/8 hover:border-black/20"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition",
          selected ? "bg-[#4758c7]" : "bg-transparent"
        )}
      />
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#f0eee9] px-2 py-1 text-[9px] font-semibold text-black/45">
          {formatName}
        </span>
        <span
          className={cn(
            "grid size-5 place-items-center rounded-full border transition",
            selected
              ? "border-[#4758c7] bg-[#4758c7] text-white"
              : "border-black/15 text-transparent group-hover:border-black/30"
          )}
        >
          <Check className="size-3" />
        </span>
      </span>
      <span className="block text-sm leading-snug font-semibold">
        {concept.hook}
      </span>
      <span className="mt-2 block text-[11px] leading-relaxed text-black/48">
        {concept.angle}
      </span>
      <span className="mt-3 block border-t border-black/7 pt-2 text-[10px] leading-relaxed text-black/38">
        Product: {concept.productPlacement}
      </span>
    </motion.button>
  )
}

function toProductDraft(product: ProductProfile) {
  return {
    name: product.name,
    niche: product.niche,
    valueProposition: product.valueProposition,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function FormatMarker({
  formatId,
  selected,
}: {
  formatId: CopyFormatId
  selected: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg border transition",
        selected
          ? "border-[#4758c7]/20 bg-white text-[#4758c7]"
          : "border-black/8 bg-[#f6f5f2] text-black/35"
      )}
    >
      {formatId === "smart" ? (
        <WandSparkles className="size-4" />
      ) : (
        <span className="grid gap-0.5 text-[8px] leading-none font-bold tabular-nums">
          <span>1 —</span>
          <span
            className={cn(formatId === "helpful-habits" && "text-[#f06f5d]")}
          >
            2 —
          </span>
          <span>3 —</span>
        </span>
      )}
    </span>
  )
}

function TextStyleMiniature({ textStyleId }: { textStyleId: TextStyleId }) {
  return (
    <span className="relative block aspect-[9/6] overflow-hidden rounded-lg bg-[linear-gradient(145deg,#8e8478,#3f453d)] ring-1 ring-black/8">
      <span
        className={cn(
          "absolute block",
          textStyleId === "clean-white" &&
            "top-[30%] right-[16%] left-[16%] h-1.5 bg-white",
          textStyleId === "soft-yellow" &&
            "top-[24%] right-[38%] left-[9%] h-1 bg-[#fff58f]",
          textStyleId === "label-body" &&
            "top-[22%] right-[13%] left-[13%] h-4 rounded bg-white"
        )}
      />
      <span
        className={cn(
          "absolute block h-1",
          textStyleId === "clean-white" &&
            "top-[45%] right-[26%] left-[26%] bg-white/80",
          textStyleId === "soft-yellow" &&
            "top-[38%] right-[28%] left-[9%] bg-[#fff58f]/80",
          textStyleId === "label-body" &&
            "top-[55%] right-[24%] left-[24%] bg-white/85"
        )}
      />
    </span>
  )
}
