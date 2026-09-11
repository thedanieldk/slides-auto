"use client"

import { FlaskConical, LayoutGrid, Plus, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { CompositionDialog } from "@/components/composition-dialog"
import { HooksCanvas } from "@/components/hooks-canvas"
import { SlideExportCard } from "@/components/slideshow-studio"
import type { CompositionResult } from "@/lib/composition"
import {
  createBlankProject,
  createProjectFromComposition,
  deleteProject,
  ensureSeedProjects,
  listProjects,
} from "@/lib/project-storage"
import { slideshowThemes, type SlideshowProject } from "@/lib/slideshow"

const tabs = [
  { id: "formats", label: "Formats", icon: LayoutGrid },
  { id: "test", label: "Test", icon: FlaskConical },
] as const

type TabId = (typeof tabs)[number]["id"]

export function SlideshowLibrary() {
  const router = useRouter()
  const [projects, setProjects] = useState<SlideshowProject[] | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("formats")

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      ensureSeedProjects()
      setProjects(listProjects())
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  function addSlideshow() {
    const project = createBlankProject()
    router.push(`/slideshow/${project.id}`)
  }

  function handleComposed(result: CompositionResult) {
    const project = createProjectFromComposition(result)
    setComposerOpen(false)
    router.push(`/slideshow/${project.id}`)
  }

  function removeSlideshow(event: React.MouseEvent, project: SlideshowProject) {
    event.preventDefault()
    event.stopPropagation()

    const shouldDelete = window.confirm(
      `Delete "${project.title}"? This can't be undone.`
    )
    if (!shouldDelete) return

    deleteProject(project.id)
    setProjects(
      (current) => current?.filter((p) => p.id !== project.id) ?? null
    )
  }

  return (
    <div className="flex min-h-svh bg-[#e9e7e2] text-[#1b1c24]">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 bg-[#f4f3ef] px-3 py-6">
        <div className="mb-4 px-2 text-sm font-semibold tracking-tight text-black/80">
          Slides Auto
        </div>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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
      </aside>

      <main className="min-h-svh flex-1 px-6 py-10 md:px-10">
        <div className="mx-auto max-w-5xl">
          {activeTab === "formats" ? (
            <>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">
                  Slideshows{projects && ` (${projects.length})`}
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
                {projects?.map((project) => {
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
                      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(42,43,55,.09)] transition group-hover:border-[#4758c7]/40">
                        {coverSlide && (
                          <SlideExportCard slide={coverSlide} theme={theme} />
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${project.title}`}
                          onClick={(event) => removeSlideshow(event, project)}
                          className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-lg bg-black/40 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                  onClick={addSlideshow}
                  aria-label="New slideshow"
                  className="flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 text-black/40 transition hover:border-[#4758c7] hover:text-[#4758c7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold">Hooks</h1>
                <p className="mt-1 text-sm text-black/50">
                  Generate a batch of opening lines with AI, then pick one in
                  Compose to write the rest of the slides.
                </p>
              </div>
              <HooksCanvas />
            </>
          )}
        </div>
      </main>

      <CompositionDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApply={handleComposed}
      />
    </div>
  )
}
