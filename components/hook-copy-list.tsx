"use client"

import { ChevronDown, LoaderCircle, Trash2, WandSparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  composeGeneratedSlideshow,
  type CompositionResult,
} from "@/lib/composition"
import { generatedSlideshowSchema } from "@/lib/ai/slideshow-generation"
import type { HookFramework } from "@/lib/ai/frameworks"
import type { SavedHook } from "@/lib/hooks-storage"
import {
  getTextLayer,
  resolveCarouselTextStyle,
  type TextStyleId,
} from "@/lib/slideshow"
import type { ProductProfile } from "@/lib/products/product-profile"

export type HookCopyState =
  | { status: "generating" }
  | { status: "error"; message: string }
  | { status: "ready"; result: CompositionResult }

export async function requestHookCopy({
  hook,
  framework,
  layoutId,
  product,
}: {
  hook: string
  framework: HookFramework
  layoutId: TextStyleId
  product: ProductProfile
}): Promise<CompositionResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "slideshow-from-hook",
      hook,
      slideCount: framework.slideCount,
      itemCount: framework.itemCount,
      layoutId,
      copyFormatId: framework.copyFormatId,
      product: toProductDraft(product),
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

  return composeGeneratedSlideshow({
    ...generated.data,
    slides: generated.data.slides.map((slide, index) => ({
      ...slide,
      layoutId: resolveCarouselTextStyle(layoutId, index),
    })),
  })
}

export function HookRow({
  hook,
  expanded,
  onToggleExpand,
  onDelete,
  copyState,
  copyDisabled,
  onGenerateCopy,
  onCreateSlideshow,
}: {
  hook: SavedHook
  expanded: boolean
  onToggleExpand: () => void
  onDelete?: () => void
  copyState: HookCopyState | undefined
  copyDisabled: boolean
  onGenerateCopy: () => void
  onCreateSlideshow: (result: CompositionResult) => void
}) {
  return (
    <div className="group px-4 py-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-snug font-medium",
              !expanded && "truncate"
            )}
          >
            {hook.text}
          </p>
          <ChevronDown
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-black/25 transition",
              expanded && "rotate-180"
            )}
          />
        </button>
        {onDelete && (
          <button
            type="button"
            aria-label="Delete hook"
            onClick={onDelete}
            className="grid size-6 shrink-0 place-items-center rounded-full text-black/25 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[#4758c7]"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 border-t border-black/8 pt-3">
          <HookCopyPanel
            copyState={copyState}
            disabled={copyDisabled}
            onGenerate={onGenerateCopy}
            onCreate={onCreateSlideshow}
          />
        </div>
      )}
    </div>
  )
}

export function HookCopyPanel({
  copyState,
  disabled,
  onGenerate,
  onCreate,
}: {
  copyState: HookCopyState | undefined
  disabled: boolean
  onGenerate: () => void
  onCreate: (result: CompositionResult) => void
}) {
  if (copyState?.status === "generating") {
    return (
      <Button size="sm" variant="outline" disabled>
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
        Writing copy…
      </Button>
    )
  }

  if (!copyState || copyState.status === "error") {
    return (
      <div>
        {copyState?.status === "error" && (
          <p className="mb-2 text-xs leading-relaxed text-red-700">
            {copyState.message}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onGenerate}
        >
          <WandSparkles data-icon="inline-start" />
          Generate copy
        </Button>
        {disabled && (
          <p className="mt-2 text-[10px] leading-relaxed text-black/40">
            Choose a product above first.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {copyState.result.slides.map((slide, index) => {
          const slideHook = getTextLayer(slide, "hook")
          const slideBody = getTextLayer(slide, "body")

          return (
            <div
              key={slide.id}
              className="rounded-lg border border-black/8 bg-[#faf9f7] p-2.5"
            >
              <p className="text-[10px] font-semibold text-black/35">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="text-xs leading-snug font-semibold">
                {slideHook?.text || "Untitled slide"}
              </p>
              {slideBody?.text && (
                <p className="mt-1 text-[11px] leading-relaxed text-black/55">
                  {slideBody.text}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => onCreate(copyState.result)}>
          Create slideshow
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerate}>
          Regenerate
        </Button>
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
