import { auth } from "@clerk/nextjs/server"

import { SlideshowLibrary } from "@/components/slideshow-library"

export default async function Page() {
  await auth.protect()
  return <SlideshowLibrary />
}
