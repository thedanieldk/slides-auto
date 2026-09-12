import { auth } from "@clerk/nextjs/server"

import { SlideshowLibrary } from "@/components/slideshow-library"
import { ensureSeedProjects, listProjects } from "@/lib/actions/slideshows"

export default async function Page() {
  await auth.protect()
  await ensureSeedProjects()
  const initialProjects = await listProjects()
  return <SlideshowLibrary initialProjects={initialProjects} />
}
