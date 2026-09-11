import {
  createProject,
  loadSlideshowProject,
  starterProject,
  type SlideshowProject,
} from "@/lib/slideshow"

const PROJECT_KEY_PREFIX = "slides-auto.project."
const LEGACY_STORAGE_KEY = "slides-auto.phase-one-project"

function projectKey(id: string) {
  return `${PROJECT_KEY_PREFIX}${id}`
}

export function listProjects(): SlideshowProject[] {
  if (typeof window === "undefined") return []

  const projects: SlideshowProject[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(PROJECT_KEY_PREFIX)) continue

    const project = readProject(key)
    if (project) projects.push(project)
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadProject(id: string): SlideshowProject | null {
  if (typeof window === "undefined") return null
  return readProject(projectKey(id))
}

export function saveProject(project: SlideshowProject) {
  window.localStorage.setItem(projectKey(project.id), JSON.stringify(project))
}

export function createBlankProject(): SlideshowProject {
  const project = createProject()
  saveProject(project)
  return project
}

/**
 * First-run setup so the library never shows up empty: migrates the old
 * single-project storage key into the new per-project format if present,
 * and guarantees at least one blank project exists alongside it.
 */
export function ensureSeedProjects() {
  if (typeof window === "undefined") return
  if (listProjects().length > 0) return

  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  const migrated = legacyRaw ? readProjectFromJson(legacyRaw) : null
  saveProject(migrated ?? structuredClone(starterProject))
  saveProject(createProject())
}

function readProject(key: string): SlideshowProject | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  return readProjectFromJson(raw)
}

function readProjectFromJson(raw: string): SlideshowProject | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return loadSlideshowProject(parsed)
  } catch {
    return null
  }
}
