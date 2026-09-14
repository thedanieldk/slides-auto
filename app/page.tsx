import { auth } from "@clerk/nextjs/server"

import { SlideshowLibrary } from "@/components/slideshow-library"
import { listSavedHooks } from "@/lib/actions/hooks"
import { ensureSeedProjects, listProjects } from "@/lib/actions/slideshows"

export default async function Page() {
  await auth.protect()
  await ensureSeedProjects()
  const [initialProjects, initialHooks] = await Promise.all([
    listProjects(),
    listSavedHooks(),
  ])
  return (
    <SlideshowLibrary
      initialProjects={initialProjects}
      initialHooks={initialHooks}
    />
  )
}
