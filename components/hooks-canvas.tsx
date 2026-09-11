"use client"

import { Lightbulb, LoaderCircle, Trash2, WandSparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProductProfilePicker } from "@/components/product-profile-picker"
import { cn } from "@/lib/utils"
import { generatedHooksSchema } from "@/lib/ai/slideshow-generation"
import { copyFormats, type CopyFormatId } from "@/lib/ai/copy-formats"
import {
  addSavedHooks,
  deleteSavedHook,
  listSavedHooks,
  type SavedHook,
} from "@/lib/hooks-storage"
import type { ProductProfile } from "@/lib/products/product-profile"

export function HooksCanvas() {
  const [selectedProduct, setSelectedProduct] = useState<ProductProfile | null>(
    null
  )
  const [copyFormatId, setCopyFormatId] = useState<CopyFormatId>("smart")
  const [hooks, setHooks] = useState<SavedHook[]>([])
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

  async function generateHooks() {
    if (!selectedProduct) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "hooks",
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
            : "The AI service could not generate hooks."
        )
      }

      const generated = generatedHooksSchema.safeParse(responseBody.data)
      if (!generated.success) {
        throw new Error("The generated hooks were incomplete. Try again.")
      }

      setHooks(addSavedHooks(generated.data.hooks))
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="h-fit rounded-2xl border border-black/10 bg-white p-4">
        <ProductProfilePicker
          value={selectedProduct}
          onChange={updateProduct}
        />

        <fieldset className="mb-5">
          <legend className="mb-3 text-xs font-semibold text-black/60">
            Copy format
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/5 p-1">
            {copyFormats.map((format) => (
              <button
                key={format.id}
                type="button"
                aria-pressed={format.id === copyFormatId}
                onClick={() => setCopyFormatId(format.id)}
                title={format.name}
                className={cn(
                  "truncate rounded-lg px-2 py-1.5 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-[#4758c7]",
                  format.id === copyFormatId
                    ? "bg-white text-black shadow-sm"
                    : "text-black/45 hover:text-black/70"
                )}
              >
                {format.name}
              </button>
            ))}
          </div>
        </fieldset>

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
          onClick={() => void generateHooks()}
        >
          {isGenerating ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
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
        {hooks.length === 0 ? (
          <div className="grid h-full min-h-[24rem] place-items-center rounded-2xl border border-dashed border-black/15 text-center text-black/40">
            <div>
              <Lightbulb className="mx-auto mb-2 size-6" />
              <p className="text-sm font-medium">No hooks yet</p>
              <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed">
                Pick a product and generate a batch of opening lines. Saved
                hooks show up here, and you can pick one to start a slideshow
                from in Compose.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {hooks.map((hook) => (
              <div
                key={hook.id}
                className="group relative rounded-xl border border-black/10 bg-white p-4 pr-9 shadow-[0_4px_14px_rgba(42,43,55,.05)]"
              >
                <p className="text-sm leading-snug font-medium">{hook.text}</p>
                <button
                  type="button"
                  aria-label="Delete hook"
                  onClick={() => removeHook(hook.id)}
                  className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full text-black/25 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4758c7]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
