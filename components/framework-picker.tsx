"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { hookFrameworks, type HookFrameworkId } from "@/lib/ai/frameworks"

export function FrameworkPicker({
  value,
  onChange,
}: {
  value: HookFrameworkId
  onChange: (id: HookFrameworkId) => void
}) {
  return (
    <fieldset className="mb-6">
      <legend className="mb-3 text-xs font-semibold text-black/60">
        Framework
      </legend>
      <div className="space-y-2">
        {hookFrameworks.map((option) => {
          const selected = option.id === value

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
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
                  <span className="text-xs font-semibold">{option.name}</span>
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
