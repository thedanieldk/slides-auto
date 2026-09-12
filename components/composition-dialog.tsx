"use client"

import {
  AlertTriangle,
  Check,
  FileText,
  ImageIcon,
  WandSparkles,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProductProfilePicker } from "@/components/product-profile-picker"
import { cn } from "@/lib/utils"
import {
  composeScript,
  hasTextOverflowRisk,
  type CompositionResult,
} from "@/lib/composition"
import {
  HookRow,
  requestHookCopy,
  type HookCopyState,
} from "@/components/hook-copy-list"
import {
  getHookFramework,
  hookFrameworks,
  type HookFrameworkId,
} from "@/lib/ai/frameworks"
import {
  listSavedHooks,
  saveHookCopy,
  type SavedHook,
} from "@/lib/hooks-storage"
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
  const [frameworkId, setFrameworkId] = useState<HookFrameworkId>(
    hookFrameworks[0]!.id
  )
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(
    null
  )
  const [savedHooks, setSavedHooks] = useState<SavedHook[]>([])
  const [expandedHookId, setExpandedHookId] = useState<string | null>(null)
  const [copyByHookId, setCopyByHookId] = useState<
    Record<string, HookCopyState>
  >({})
  const [textStyleId, setTextStyleId] = useState<TextStyleId>("clean-white")
  const [result, setResult] = useState<CompositionResult | null>(null)

  const framework = getHookFramework(frameworkId)
  const frameworkHooks = savedHooks.filter(
    (hook) => hook.frameworkId === frameworkId
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => setSavedHooks(listSavedHooks()), 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  async function generateCopy(hook: SavedHook) {
    if (!selectedProduct) return

    setCopyByHookId((current) => ({
      ...current,
      [hook.id]: { status: "generating" },
    }))

    try {
      const result = await requestHookCopy({
        hook: hook.text,
        framework,
        layoutId: textStyleId,
        product: selectedProduct,
      })

      setSavedHooks(saveHookCopy(hook.id, result))
      setCopyByHookId((current) => {
        const next = { ...current }
        delete next[hook.id]
        return next
      })
    } catch (generationError) {
      setCopyByHookId((current) => ({
        ...current,
        [hook.id]: {
          status: "error",
          message:
            generationError instanceof Error
              ? generationError.message
              : "Something went wrong while generating the slideshow.",
        },
      }))
    }
  }

  function toggleHookExpanded(id: string) {
    setExpandedHookId((current) => (current === id ? null : id))
  }

  function buildScriptPreview() {
    if (script.trim().length < 12) return
    setResult(composeScript({ script, layoutId: textStyleId }))
  }

  function updateScript(value: string) {
    setScript(value)
    setResult(null)
  }

  function updateTextStyle(value: TextStyleId) {
    setTextStyleId(value)
    setResult(null)
    setExpandedHookId(null)
    setCopyByHookId({})
  }

  function updateMode(value: ComposerMode) {
    setMode(value)
    setResult(null)
    setExpandedHookId(null)
    setCopyByHookId({})
  }

  function updateFramework(value: HookFrameworkId) {
    setFrameworkId(value)
    setExpandedHookId(null)
    setCopyByHookId({})
  }

  const updateProduct = useCallback((product: ProductProfile | null) => {
    setSelectedProduct(product)
    setExpandedHookId(null)
    setCopyByHookId({})
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
                  Pick a framework and write a hook&apos;s full copy, or split
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
                      allowNoProduct={false}
                    />

                    <fieldset className="mb-6">
                      <legend className="mb-3 text-xs font-semibold text-black/60">
                        Framework
                      </legend>
                      <div className="space-y-2">
                        {hookFrameworks.map((option) => {
                          const selected = option.id === frameworkId

                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => updateFramework(option.id)}
                              className={cn(
                                "group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                                selected
                                  ? "border-[#4758c7] bg-[#eef0ff]"
                                  : "border-black/10 bg-white hover:border-black/20"
                              )}
                            >
                              <FrameworkMarker selected={selected} />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold">
                                    {option.name}
                                  </span>
                                  {selected && (
                                    <Check className="size-3.5 shrink-0 text-[#4758c7]" />
                                  )}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-black/45">
                                  {option.description}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  </>
                )}

                <fieldset>
                  <legend className="mb-3 text-xs font-semibold text-black/60">
                    Text style
                  </legend>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
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

                {mode === "script" && (
                  <Button
                    className="mt-5 w-full"
                    disabled={script.trim().length < 12}
                    onClick={() => buildScriptPreview()}
                  >
                    <WandSparkles data-icon="inline-start" />
                    Build preview
                  </Button>
                )}
              </div>

              <div className="flex min-h-80 flex-col bg-[#efede8] p-5 md:p-7 lg:overflow-hidden">
                {mode === "ai" ? (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold">Pick a hook</h3>
                      <p className="text-[11px] text-black/40">
                        Choose one of your saved {framework.name} hooks, then
                        write its full copy.
                      </p>
                    </div>

                    {frameworkHooks.length === 0 ? (
                      <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-black/12 bg-white/45 px-8 text-center">
                        <div>
                          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-white text-black/35 shadow-sm">
                            <WandSparkles className="size-4" />
                          </div>
                          <p className="text-xs font-semibold">
                            No {framework.name} hooks yet
                          </p>
                          <p className="mt-1 max-w-52 text-[11px] leading-relaxed text-black/40">
                            Generate some in the Copy tab first, then come back
                            here to write the full slideshow.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-black/10 bg-white">
                        <div className="divide-y divide-black/8">
                          {frameworkHooks.map((hook) => (
                            <HookRow
                              key={hook.id}
                              hook={hook}
                              expanded={expandedHookId === hook.id}
                              onToggleExpand={() => toggleHookExpanded(hook.id)}
                              copyState={
                                copyByHookId[hook.id] ??
                                (hook.generatedCopy
                                  ? {
                                      status: "ready",
                                      result: hook.generatedCopy,
                                    }
                                  : undefined)
                              }
                              copyDisabled={!selectedProduct}
                              onGenerateCopy={() => void generateCopy(hook)}
                              onCreateSlideshow={onApply}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Composition preview
                        </h3>
                        <p className="text-[11px] text-black/40">
                          Review the split before creating your slides.
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
                          Create slideshow with {result.slides.length} slides
                        </Button>
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-black/12 bg-white/45 px-8 text-center">
                        <div>
                          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-white text-black/35 shadow-sm">
                            <WandSparkles className="size-4" />
                          </div>
                          <p className="text-xs font-semibold">
                            No preview yet
                          </p>
                          <p className="mt-1 max-w-52 text-[11px] leading-relaxed text-black/40">
                            Add at least a sentence, choose a layout, then build
                            the composition.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FrameworkMarker({ selected }: { selected: boolean }) {
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
      <span className="grid gap-0.5 text-[8px] leading-none font-bold tabular-nums">
        <span>1 —</span>
        <span>2 —</span>
        <span>3 —</span>
      </span>
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
          textStyleId === "yellow-cover" &&
            "top-[24%] right-[12%] left-[12%] h-5 bg-[#fff58f]",
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
          textStyleId === "yellow-cover" &&
            "top-[62%] right-[32%] left-[32%] bg-white/90",
          textStyleId === "label-body" &&
            "top-[55%] right-[24%] left-[24%] bg-white/85"
        )}
      />
    </span>
  )
}
