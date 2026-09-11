import { SlideshowStudio } from "@/components/slideshow-studio"

export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SlideshowStudio projectId={id} key={id} />
}
