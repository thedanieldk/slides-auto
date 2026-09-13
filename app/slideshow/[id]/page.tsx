import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { SlideshowStudio } from "@/components/slideshow-studio"
import { loadProject } from "@/lib/actions/slideshows"

export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await auth.protect()
  const { id } = await params
  const project = await loadProject(id)
  if (!project) redirect("/")

  return <SlideshowStudio initialProject={project} key={id} />
}
