"use client"

import {
  ChevronDown,
  Lightbulb,
  LoaderCircle,
  WandSparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProductProfilePicker } from "@/components/product-profile-picker"
import { cn } from "@/lib/utils"
import { type CompositionResult } from "@/lib/composition"
import {
  HookRow,
  requestHookCopy,
  type HookCopyState,
} from "@/components/hook-copy-list"
import { generatedHooksSchema } from "@/lib/ai/slideshow-generation"
import {
  hookFrameworks,
  type HookFramework,
  type HookFrameworkId,
} from "@/lib/ai/frameworks"
import {
  addSavedHooks,
  deleteSavedHook,
  listSavedHooks,
  type SavedHook,
} from "@/lib/hooks-storage"
import { createProjectFromComposition } from "@/lib/project-storage"
import type { ProductProfile } from "@/lib/products/product-profile"

export function HooksCanvas() {
  const router = useRouter()
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(
    null
  )
  const [examplesText, setExamplesText] = useState("")
  const [expandedFrameworkId, setExpandedFrameworkId] =
    useState<HookFrameworkId | null>(hookFrameworks[0]?.id ?? null)
  const [hooks, setHooks] = useState<SavedHook[]>([])
  const [expandedHookIds, setExpandedHookIds] = useState<Set<string>>(new Set())
  const [copyByHookId, setCopyByHookId] = useState<
    Record<string, HookCopyState>
  >({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHooks(listSavedHooks())
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const updateProduct = useCallback((product: ProductProfile | null) => {
    setSelectedProduct(product)
  }, [])

  async function generateHooks(framework: HookFramework) {
    if (!selectedProduct) return

    setIsGenerating(true)
    setError(null)

    const examples = examplesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "hooks",
          frameworkId: framework.id,
          examples,
          product: toProductDraft(selectedProduct),
        }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}

      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "The AI service could not generate hooks."
        )
      }

      const generated = generatedHooksSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("The generated hooks were incomplete. Try again.")
      }

      setHooks(addSavedHooks(generated.data.hooks, framework.id))
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Something went wrong while generating hooks."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  function removeHook(id: string) {
    setHooks(deleteSavedHook(id))
  }

  function toggleHookExpanded(id: string) {
    setExpandedHookIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function generateCopy(hook: SavedHook, framework: HookFramework) {
    if (!selectedProduct) return

    setCopyByHookId((current) => ({
      ...current,
      [hook.id]: { status: "generating" },
    }))

    try {
      const result = await requestHookCopy({
        hook: hook.text,
        framework,
        layoutId: "clean-white",
        product: selectedProduct,
      })

      setCopyByHookId((current) => ({
        ...current,
        [hook.id]: { status: "ready", result },
      }))
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

  function createSlideshow(result: CompositionResult) {
    const project = createProjectFromComposition(result)
    router.push(`/slideshow/${project.id}`)
  }

  return (
    <div className="space-y-4">
      {hookFrameworks.map((framework) => {
        const expanded = expandedFrameworkId === framework.id
        const frameworkHooks = hooks.filter(
          (hook) => hook.frameworkId === framework.id
        )

        return (
          <div
            key={framework.id}
            className="overflow-hidden rounded-2xl border border-black/10 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedFrameworkId(expanded ? null : framework.id)
              }
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-4 p-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold">{framework.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/45">
                  {framework.description}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-black/30 transition",
                  expanded && "rotate-180"
                )}
              />
            </button>

            {expanded && (
              <div className="border-t border-black/8 p-4">
                <div className="mb-5 rounded-xl bg-[#f6f5f2] p-3">
                  <p className="text-xs font-semibold">
                    {framework.exampleTitle}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-black/50">
                    {framework.exampleSlide}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                  <div className="h-fit rounded-2xl border border-black/10 bg-[#faf9f7] p-4">
                    <ProductProfilePicker
                      value={selectedProduct}
                      onChange={updateProduct}
                      allowNoProduct={false}
                    />

                    <label className="mb-5 block">
                      <span className="mb-2 block text-xs font-semibold text-black/60">
                        More examples{" "}
                        <span className="font-normal text-black/35">
                          (optional)
                        </span>
                      </span>
                      <textarea
                        value={examplesText}
                        maxLength={800}
                        rows={3}
                        onChange={(event) =>
                          setExamplesText(event.target.value)
                        }
                        placeholder="Any other hooks in this style you want more of, one per line"
                        className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs leading-relaxed transition outline-none placeholder:text-black/28 focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                      />
                    </label>

                    {error && (
                      <p
                        className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      className="w-full"
                      disabled={!selectedProduct || isGenerating}
                      onClick={() => void generateHooks(framework)}
                    >
                      {isGenerating ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <WandSparkles data-icon="inline-start" />
                      )}
                      {isGenerating ? "Writing hooks…" : "Generate 8 hooks"}
                    </Button>
                    {!selectedProduct && (
                      <p className="mt-2 text-center text-[10px] leading-relaxed text-black/40">
                        Choose a saved product or add one from a link first.
                      </p>
                    )}
                  </div>

                  <div>
                    {frameworkHooks.length === 0 ? (
                      <div className="grid h-full min-h-[16rem] place-items-center rounded-2xl border border-dashed border-black/15 text-center text-black/40">
                        <div>
                          <Lightbulb className="mx-auto mb-2 size-6" />
                          <p className="text-sm font-medium">No hooks yet</p>
                          <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed">
                            Pick a product and generate a batch of{" "}
                            {framework.name.toLowerCase()} hooks. Expand one to
                            write its full copy and turn it into a slideshow.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-black/10 bg-white">
                        <div className="divide-y divide-black/8">
                          {frameworkHooks.map((hook) => (
                            <HookRow
                              key={hook.id}
                              hook={hook}
                              expanded={expandedHookIds.has(hook.id)}
                              onToggleExpand={() => toggleHookExpanded(hook.id)}
                              onDelete={() => removeHook(hook.id)}
                              copyState={copyByHookId[hook.id]}
                              copyDisabled={!selectedProduct}
                              onGenerateCopy={() =>
                                void generateCopy(hook, framework)
                              }
                              onCreateSlideshow={createSlideshow}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
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
