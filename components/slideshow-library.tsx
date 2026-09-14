"use client"

import { UserButton } from "@clerk/nextjs"
import {
  CheckCircle2,
  Circle,
  LayoutGrid,
  LoaderCircle,
  PenLine,
  Plus,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { CompositionDialog } from "@/components/composition-dialog"
import { FrameworkPicker } from "@/components/framework-picker"
import { HooksCanvas } from "@/components/hooks-canvas"
import { requestHookCopy } from "@/components/hook-copy-list"
import {
  ProductProfilePicker,
  SELECTED_PROFILE_STORAGE_KEY,
} from "@/components/product-profile-picker"
import { SlideExportCard } from "@/components/slideshow-studio"
import { TextStyleMiniature } from "@/components/text-style-miniature"
import { cn } from "@/lib/utils"
import type { CompositionResult } from "@/lib/composition"
import {
  getHookFramework,
  hookFrameworks,
  type HookFrameworkId,
} from "@/lib/ai/frameworks"
import { generatedHooksSchema } from "@/lib/ai/slideshow-generation"
import { autoFillSlideImages } from "@/lib/images/auto-fill"
import {
  createBlankProject,
  createProjectFromComposition,
  deleteProject,
  listProjects,
  setProjectPosted,
} from "@/lib/actions/slideshows"
import { listProductProfiles } from "@/lib/actions/products"
import type { ProductProfile } from "@/lib/products/product-profile"
import type { SavedHook } from "@/lib/hooks-storage"
import {
  slideshowThemes,
  textStyles,
  type SlideshowProject,
  type TextStyleId,
} from "@/lib/slideshow"

const CREATE_BATCH_SIZES = [2, 3, 4, 5] as const

const tabs = [
  { id: "formats", label: "Formats", icon: LayoutGrid },
  { id: "copy", label: "Copy", icon: PenLine },
] as const

type TabId = (typeof tabs)[number]["id"]

type SlideshowLibraryProps = {
  initialProjects: SlideshowProject[]
  initialHooks: SavedHook[]
  initialProducts: ProductProfile[]
}

export function SlideshowLibrary({
  initialProjects,
  initialHooks,
  initialProducts,
}: SlideshowLibraryProps) {
  const router = useRouter()
  const [projects, setProjects] = useState<SlideshowProject[]>(initialProjects)
  const [composerOpen, setComposerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("formats")
  const [hasVisitedCopyTab, setHasVisitedCopyTab] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createPromptProduct, setCreatePromptProduct] =
    useState<ProductProfile | null>(null)
  const [createTextStyleId, setCreateTextStyleId] = useState<TextStyleId>(
    textStyles[0]!.id
  )
  const [createFrameworkId, setCreateFrameworkId] = useState<HookFrameworkId>(
    hookFrameworks[0]!.id
  )
  const [createBatchSize, setCreateBatchSize] = useState<number>(
    CREATE_BATCH_SIZES[CREATE_BATCH_SIZES.length - 1]
  )
  const [isCreating, setIsCreating] = useState(false)
  const [createProgress, setCreateProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  function selectTab(tab: TabId) {
    setActiveTab(tab)
    if (tab === "copy") setHasVisitedCopyTab(true)
  }

  useEffect(() => {
    let cancelled = false
    void listProjects().then((loaded) => {
      if (!cancelled) setProjects(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function addSlideshow() {
    const project = await createBlankProject()
    router.push(`/slideshow/${project.id}`)
  }

  async function handleComposed(
    result: CompositionResult,
    productId: string | null
  ) {
    const project = await createProjectFromComposition(result, productId)
    setComposerOpen(false)
    router.push(`/slideshow/${project.id}`)
  }

  async function startCreate() {
    const products = await listProductProfiles()
    const storedId = window.localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY)
    const preferred =
      products.find((product) => product.id === storedId) ?? products[0] ?? null

    setCreatePromptProduct(preferred)
    setCreateTextStyleId(textStyles[0]!.id)
    setCreateFrameworkId(hookFrameworks[0]!.id)
    setCreateBatchSize(CREATE_BATCH_SIZES[CREATE_BATCH_SIZES.length - 1])
    setCreateDialogOpen(true)
  }

  async function runCreateBatch(
    product: ProductProfile,
    layoutId: TextStyleId,
    frameworkId: HookFrameworkId,
    batchSize: number
  ) {
    const framework = getHookFramework(frameworkId)

    setCreateDialogOpen(false)
    setIsCreating(true)
    setCreateProgress({ done: 0, total: batchSize })

    try {
      const hookResponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "hooks",
          frameworkId: framework.id,
          examples: [],
          product: {
            name: product.name,
            niche: product.niche,
            valueProposition: product.valueProposition,
          },
        }),
      })
      const hookPayload: unknown = await hookResponse.json()
      const hookBody = isRecord(hookPayload) ? hookPayload : {}
      if (!hookResponse.ok) {
        throw new Error(
          typeof hookBody.error === "string"
            ? hookBody.error
            : "Could not generate hooks."
        )
      }

      const generatedHooks = generatedHooksSchema.safeParse(hookBody.data)
      if (!generatedHooks.success) {
        throw new Error("The generated hooks were incomplete. Try again.")
      }

      const hookTexts = generatedHooks.data.hooks.slice(0, batchSize)
      let createdCount = 0

      for (const hookText of hookTexts) {
        try {
          const composition = await requestHookCopy({
            hook: hookText,
            framework,
            layoutId,
            product,
          })
          const filled = await autoFillSlideImages(composition.slides)
          const project = await createProjectFromComposition(
            { ...composition, slides: filled.slides },
            product.id
          )
          setProjects((current) => [project, ...current])
          createdCount += 1
        } catch (batchError) {
          console.error("Create batch: one slideshow failed", batchError)
        }
        setCreateProgress({ done: createdCount, total: batchSize })
      }
    } catch (createError) {
      console.error("Create batch failed:", createError)
    } finally {
      setIsCreating(false)
      setCreateProgress(null)
    }
  }

  async function removeSlideshow(
    event: React.MouseEvent,
    project: SlideshowProject
  ) {
    event.preventDefault()
    event.stopPropagation()

    const shouldDelete = window.confirm(
      `Delete "${project.title}"? This can't be undone.`
    )
    if (!shouldDelete) return

    setProjects((current) => current.filter((p) => p.id !== project.id))
    await deleteProject(project.id)
  }

  async function togglePosted(
    event: React.MouseEvent,
    project: SlideshowProject
  ) {
    event.preventDefault()
    event.stopPropagation()

    const posted = !project.posted
    setProjects((current) =>
      current.map((p) => (p.id === project.id ? { ...p, posted } : p))
    )
    await setProjectPosted(project.id, posted)
  }

  return (
    <div className="flex min-h-svh bg-[#e9e7e2] text-[#1b1c24]">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 bg-[#f4f3ef] px-3 py-6">
        <div className="mb-4 px-2 text-sm font-semibold tracking-tight text-black/80">
          Slides Auto
        </div>

        <Button
          className="mb-3 w-full bg-[#171821] text-white hover:bg-[#0f1018]"
          disabled={isCreating}
          onClick={() => void startCreate()}
        >
          {isCreating ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Rocket data-icon="inline-start" />
          )}
          {isCreating && createProgress
            ? `Creating ${createProgress.done}/${createProgress.total}…`
            : "Create"}
        </Button>
        {isCreating && (
          <p className="mb-3 px-2 text-[10px] leading-relaxed text-black/40">
            Writing hooks, copy, and finding images. This takes a minute or two.
          </p>
        )}

        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${
                active
                  ? "bg-[#4758c7] text-white"
                  : "text-black/60 hover:bg-black/5 hover:text-black/80"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}

        <div className="mt-auto flex items-center gap-2 px-2 pt-4">
          <UserButton />
          <span className="text-xs text-black/50">Account</span>
        </div>
      </aside>

      <main className="min-h-svh flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div hidden={activeTab !== "formats"}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold">
                Slideshows ({projects.length})
              </h1>
              <Button
                className="bg-[#4758c7] text-white hover:bg-[#3d4db8]"
                onClick={() => setComposerOpen(true)}
              >
                <Sparkles data-icon="inline-start" />
                Compose
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {projects.map((project) => {
                const theme =
                  slideshowThemes.find((t) => t.id === project.themeId) ??
                  slideshowThemes[0]
                const coverSlide = project.slides[0]

                return (
                  <Link
                    key={project.id}
                    href={`/slideshow/${project.id}`}
                    className="group relative block"
                  >
                    <div
                      className={cn(
                        "relative aspect-[9/16] overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(42,43,55,.09)] transition group-hover:border-[#4758c7]/40",
                        project.posted
                          ? "border-emerald-400"
                          : "border-black/10"
                      )}
                    >
                      {coverSlide && (
                        <SlideExportCard slide={coverSlide} theme={theme} />
                      )}
                      <button
                        type="button"
                        aria-label={
                          project.posted
                            ? `Mark ${project.title} as not posted`
                            : `Mark ${project.title} as posted`
                        }
                        title={project.posted ? "Posted" : "Mark as posted"}
                        onClick={(event) => void togglePosted(event, project)}
                        className={cn(
                          "absolute top-2 left-2 z-10 grid size-7 place-items-center rounded-full backdrop-blur-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                          project.posted
                            ? "bg-emerald-500 text-white"
                            : "bg-black/40 text-white hover:bg-black/60"
                        )}
                      >
                        {project.posted ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${project.title}`}
                        onClick={(event) =>
                          void removeSlideshow(event, project)
                        }
                        className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-lg bg-black/40 text-white backdrop-blur-sm transition hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-black/70">
                      {project.title}
                    </p>
                  </Link>
                )
              })}

              <button
                type="button"
                onClick={() => void addSlideshow()}
                aria-label="New slideshow"
                className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 text-black/40 transition hover:border-[#4758c7] hover:text-[#4758c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]"
              >
                <Plus className="size-6" />
              </button>
            </div>
          </div>

          {hasVisitedCopyTab && (
            <div hidden={activeTab !== "copy"}>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold">Frameworks</h1>
                <p className="mt-1 text-sm text-black/50">
                  Pick a copy framework, generate hooks that follow its
                  structure, then expand one to write the full slideshow copy.
                </p>
              </div>
              <HooksCanvas
                initialHooks={initialHooks}
                initialProducts={initialProducts}
              />
            </div>
          )}
        </div>
      </main>

      <CompositionDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApply={handleComposed}
        initialProducts={initialProducts}
      />

      {createDialogOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#171820]/55 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setCreateDialogOpen(false)
            }
          }}
        >
          <div className="max-h-[85svh] w-full max-w-sm overflow-y-auto rounded-2xl border border-black/10 bg-[#f8f7f4] p-5 shadow-2xl">
            <p className="mb-1 text-sm font-semibold">
              Create {createBatchSize} slideshows
            </p>
            <p className="mb-4 text-xs leading-relaxed text-black/50">
              Writes hooks, full copy, slides, and images automatically for the
              product, framework, and text style below.
            </p>
            <ProductProfilePicker
              value={createPromptProduct}
              onChange={setCreatePromptProduct}
              allowNoProduct={false}
              initialProfiles={initialProducts}
            />
            <FrameworkPicker
              value={createFrameworkId}
              onChange={setCreateFrameworkId}
            />
            <fieldset className="mb-5">
              <legend className="mb-3 text-xs font-semibold text-black/60">
                Text style
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {textStyles.map((textStyle) => (
                  <button
                    key={textStyle.id}
                    type="button"
                    onClick={() => setCreateTextStyleId(textStyle.id)}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                      textStyle.id === createTextStyleId
                        ? "border-[#4758c7] bg-[#eef0ff]"
                        : "border-black/10 bg-white hover:border-black/20"
                    )}
                  >
                    <TextStyleMiniature textStyleId={textStyle.id} />
                    <span className="mt-2 block text-[11px] font-semibold">
                      {textStyle.name}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mb-5">
              <legend className="mb-3 text-xs font-semibold text-black/60">
                How many slideshows
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {CREATE_BATCH_SIZES.map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={count === createBatchSize}
                    onClick={() => setCreateBatchSize(count)}
                    className={cn(
                      "rounded-xl border py-2.5 text-center text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]",
                      count === createBatchSize
                        ? "border-[#4758c7] bg-[#eef0ff] text-[#4758c7]"
                        : "border-black/10 bg-white text-black/60 hover:border-black/20"
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>
            <Button
              className="w-full"
              disabled={!createPromptProduct}
              onClick={() =>
                createPromptProduct &&
                void runCreateBatch(
                  createPromptProduct,
                  createTextStyleId,
                  createFrameworkId,
                  createBatchSize
                )
              }
            >
              Create {createBatchSize} slideshows
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
