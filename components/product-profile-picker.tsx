"use client"

import {
  Check,
  Link2,
  LoaderCircle,
  PackageOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  deleteProductProfile,
  listProductProfiles,
  upsertProductProfile,
} from "@/lib/actions/products"
import {
  productProfileAnalysisSchema,
  productProfileDraftSchema,
  type ProductProfile,
  type ProductProfileDraft,
} from "@/lib/products/product-profile"

const SELECTED_PROFILE_STORAGE_KEY = "slides-auto.selected-product-profile.v1"

type ProductProfilePickerProps = {
  value: ProductProfile | null
  onChange: (profile: ProductProfile | null) => void
  allowNoProduct?: boolean
}

type ProfileAnalysis = ProductProfileDraft & { sourceUrl: string }

export function ProductProfilePicker({
  value,
  onChange,
  allowNoProduct = true,
}: ProductProfilePickerProps) {
  const [profiles, setProfiles] = useState<ProductProfile[]>([])
  const [addingProduct, setAddingProduct] = useState(false)
  const [url, setUrl] = useState("")
  const [draft, setDraft] = useState<ProfileAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void listProductProfiles().then((loaded) => {
      if (cancelled) return
      setProfiles(loaded)

      const selectedId = window.localStorage.getItem(
        SELECTED_PROFILE_STORAGE_KEY
      )
      const selected = loaded.find((profile) => profile.id === selectedId)
      if (selected) onChange(selected)
    })

    return () => {
      cancelled = true
    }
  }, [onChange])

  function selectProfile(profile: ProductProfile | null) {
    onChange(profile)
    if (profile) {
      window.localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profile.id)
    } else {
      window.localStorage.removeItem(SELECTED_PROFILE_STORAGE_KEY)
    }
  }

  async function analyzeProduct() {
    if (url.trim().length < 3) return

    setIsAnalyzing(true)
    setDraft(null)
    setError(null)

    try {
      const response = await fetch("/api/products/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const payload: unknown = await response.json()
      const responseBody = isRecord(payload) ? payload : {}
      if (!response.ok) {
        throw new Error(
          typeof responseBody.error === "string"
            ? responseBody.error
            : "The product page could not be analyzed."
        )
      }

      const analysis = productProfileAnalysisSchema.safeParse(responseBody.data)
      if (!analysis.success) {
        throw new Error("The generated product profile was incomplete.")
      }
      setDraft(analysis.data)
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Something went wrong while analyzing the product."
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  function updateDraft(changes: Partial<ProductProfileDraft>) {
    setDraft((current) => (current ? { ...current, ...changes } : current))
  }

  async function saveProduct() {
    if (!draft) return
    const parsedDraft = productProfileDraftSchema.safeParse(draft)
    if (!parsedDraft.success) {
      setError("Complete all three product fields before saving.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const profile = await upsertProductProfile({
        ...parsedDraft.data,
        sourceUrl: draft.sourceUrl,
      })

      setProfiles((current) => {
        const existingIndex = current.findIndex(
          (item) => item.id === profile.id
        )
        if (existingIndex === -1) return [profile, ...current]
        return current.map((item, index) =>
          index === existingIndex ? profile : item
        )
      })
      selectProfile(profile)
      closeAddProduct()
    } catch {
      setError("Could not save the product. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteProfile(profileId: string) {
    setProfiles((current) =>
      current.filter((profile) => profile.id !== profileId)
    )
    if (value?.id === profileId) selectProfile(null)
    await deleteProductProfile(profileId)
  }

  function closeAddProduct() {
    setAddingProduct(false)
    setUrl("")
    setDraft(null)
    setError(null)
  }

  return (
    <fieldset className="mb-6 min-w-0">
      <legend className="mb-3 text-xs font-semibold text-black/60">
        Product
      </legend>

      <div className="space-y-2">
        {allowNoProduct && (
          <button
            type="button"
            aria-pressed={value === null}
            onClick={() => selectProfile(null)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
              value === null
                ? "border-[#4758c7] bg-[#eef0ff]"
                : "border-black/10 bg-white hover:border-black/20"
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-black/8 bg-[#f6f5f2] text-black/35">
              <PackageOpen className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">No product</span>
              <span className="mt-0.5 block text-[11px] text-black/45">
                Keep this slideshow non-promotional.
              </span>
            </span>
            {value === null && <Check className="size-3.5 text-[#4758c7]" />}
          </button>
        )}

        {profiles.map((profile) => {
          const selected = profile.id === value?.id
          return (
            <div
              key={profile.id}
              className={cn(
                "flex items-stretch overflow-hidden rounded-xl border transition",
                selected
                  ? "border-[#4758c7] bg-[#eef0ff]"
                  : "border-black/10 bg-white hover:border-black/20"
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => selectProfile(profile)}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#4758c7]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#4758c7] text-sm font-semibold text-white">
                  {profile.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span className="truncate">{profile.name}</span>
                    {selected && (
                      <Check className="size-3.5 shrink-0 text-[#4758c7]" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-black/45">
                    {profile.niche}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${profile.name}`}
                title={`Delete ${profile.name}`}
                onClick={() => void deleteProfile(profile.id)}
                className="grid w-10 shrink-0 place-items-center border-l border-black/8 text-black/25 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-[#4758c7]"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {!addingProduct ? (
        <Button
          variant="outline"
          className="mt-2 w-full"
          onClick={() => setAddingProduct(true)}
        >
          <Plus data-icon="inline-start" />
          Add product from link
        </Button>
      ) : (
        <div className="mt-2 rounded-2xl border border-black/10 bg-[#f1efe9] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Add a product</p>
              <p className="mt-0.5 text-[10px] text-black/40">
                AI will draft three editable fields.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close product setup"
              onClick={closeAddProduct}
              className="grid size-7 place-items-center rounded-full text-black/35 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[#4758c7]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {!draft ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void analyzeProduct()
              }}
            >
              <label className="block">
                <span className="sr-only">Product website</span>
                <div className="flex items-center rounded-xl border border-black/10 bg-white focus-within:border-[#4758c7] focus-within:ring-3 focus-within:ring-[#4758c7]/10">
                  <Link2 className="ml-3 size-3.5 shrink-0 text-black/30" />
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    value={url}
                    onChange={(event) => {
                      setUrl(event.target.value)
                      setError(null)
                    }}
                    placeholder="yourproduct.com"
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-xs outline-none placeholder:text-black/28"
                  />
                </div>
              </label>
              <Button
                className="mt-2 w-full"
                disabled={url.trim().length < 3 || isAnalyzing}
                type="submit"
              >
                {isAnalyzing ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <Link2 data-icon="inline-start" />
                )}
                {isAnalyzing ? "Reading product page…" : "Create profile"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <ProfileField
                label="Product name"
                maxLength={80}
                value={draft.name}
                onChange={(name) => updateDraft({ name })}
              />
              <ProfileField
                label="Niche"
                maxLength={120}
                value={draft.niche}
                onChange={(niche) => updateDraft({ niche })}
              />
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold text-black/50">
                  Value proposition
                </span>
                <textarea
                  value={draft.valueProposition}
                  maxLength={280}
                  rows={3}
                  onChange={(event) =>
                    updateDraft({ valueProposition: event.target.value })
                  }
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                />
              </label>
              <p className="truncate text-[9px] text-black/30">
                Source: {draft.sourceUrl}
              </p>
              <Button
                className="w-full"
                disabled={isSaving}
                onClick={() => void saveProduct()}
              >
                {isSaving ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : null}
                {isSaving ? "Saving…" : "Save and use product"}
              </Button>
            </div>
          )}

          {error && (
            <p
              className="mt-2 text-[11px] leading-relaxed text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}

function ProfileField({
  label,
  maxLength,
  onChange,
  value,
}: {
  label: string
  maxLength: number
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold text-black/50">
        {label}
      </span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
      />
    </label>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
