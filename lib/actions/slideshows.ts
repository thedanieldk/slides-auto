"use server"

import { and, desc, eq } from "drizzle-orm"

import type { CompositionResult } from "@/lib/composition"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { db } from "@/lib/db"
import { slideshows } from "@/lib/db/schema"
import {
  createProject,
  starterProject,
  type SlideshowProject,
} from "@/lib/slideshow"

function toProject(row: typeof slideshows.$inferSelect): SlideshowProject {
  return {
    version: 2,
    id: row.id,
    title: row.title,
    themeId: row.themeId as SlideshowProject["themeId"],
    activeSlideId: row.activeSlideId,
    slides: row.slides,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listProjects(): Promise<SlideshowProject[]> {
  const userId = await getCurrentUserId()
  const rows = await db
    .select()
    .from(slideshows)
    .where(eq(slideshows.userId, userId))
    .orderBy(desc(slideshows.updatedAt))

  return rows.map(toProject)
}

export async function loadProject(
  id: string
): Promise<SlideshowProject | null> {
  const userId = await getCurrentUserId()
  const [row] = await db
    .select()
    .from(slideshows)
    .where(and(eq(slideshows.id, id), eq(slideshows.userId, userId)))
    .limit(1)

  return row ? toProject(row) : null
}

export async function saveProject(project: SlideshowProject): Promise<void> {
  const userId = await getCurrentUserId()

  await db
    .insert(slideshows)
    .values({
      id: project.id,
      userId,
      title: project.title,
      themeId: project.themeId,
      activeSlideId: project.activeSlideId,
      slides: project.slides,
    })
    .onConflictDoUpdate({
      target: slideshows.id,
      set: {
        title: project.title,
        themeId: project.themeId,
        activeSlideId: project.activeSlideId,
        slides: project.slides,
        updatedAt: new Date(),
      },
    })
}

export async function deleteProject(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  await db
    .delete(slideshows)
    .where(and(eq(slideshows.id, id), eq(slideshows.userId, userId)))
}

export async function createBlankProject(): Promise<SlideshowProject> {
  const project = createProject()
  await saveProject(project)
  return project
}

export async function createProjectFromComposition(
  result: CompositionResult
): Promise<SlideshowProject> {
  const project: SlideshowProject = {
    version: 2,
    id: crypto.randomUUID(),
    title: result.title,
    themeId: "paper",
    activeSlideId: result.slides[0]!.id,
    slides: result.slides,
    updatedAt: new Date().toISOString(),
  }
  await saveProject(project)
  return project
}

/**
 * First-run setup so the library never shows up empty for a brand new
 * user: guarantees the starter slideshow exists.
 */
export async function ensureSeedProjects(): Promise<void> {
  const userId = await getCurrentUserId()
  const [existing] = await db
    .select({ id: slideshows.id })
    .from(slideshows)
    .where(eq(slideshows.userId, userId))
    .limit(1)
  if (existing) return

  await saveProject({
    ...structuredClone(starterProject),
    id: crypto.randomUUID(),
  })
}
