import { auth } from "@clerk/nextjs/server"

import { SlideshowStudio } from "@/components/slideshow-studio"

export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await auth.protect()
  const { id } = await params
  return <SlideshowStudio projectId={id} key={id} />
}
