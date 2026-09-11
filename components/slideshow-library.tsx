"use client"

import { Plus, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { CompositionDialog } from "@/components/composition-dialog"
import { SlideExportCard } from "@/components/slideshow-studio"
import type { CompositionResult } from "@/lib/composition"
import {
  createBlankProject,
  createProjectFromComposition,
  ensureSeedProjects,
  listProjects,
} from "@/lib/project-storage"
import { slideshowThemes, type SlideshowProject } from "@/lib/slideshow"

export function SlideshowLibrary() {
  const router = useRouter()
  const [projects, setProjects] = useState<SlideshowProject[] | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

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

  return (
    <main className="min-h-svh bg-[#e9e7e2] px-6 py-10 text-[#1b1c24] md:px-10">
      <div className="mx-auto max-w-5xl">
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
                className="group block"
              >
                <div className="aspect-[9/16] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_8px_24px_rgba(42,43,55,.09)] transition group-hover:border-[#4758c7]/40">
                  {coverSlide && (
                    <SlideExportCard slide={coverSlide} theme={theme} />
                  )}
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
      </div>

      <CompositionDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApply={handleComposed}
      />
    </main>
  )
}
