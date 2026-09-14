import { auth } from "@clerk/nextjs/server"

import { SlideshowLibrary } from "@/components/slideshow-library"
import { listSavedHooks } from "@/lib/actions/hooks"
import { listProductProfiles } from "@/lib/actions/products"
import { ensureSeedProjects, listProjects } from "@/lib/actions/slideshows"

export default async function Page() {
  await auth.protect()
  await ensureSeedProjects()
  const [initialProjects, initialHooks, initialProducts] = await Promise.all([
    listProjects(),
    listSavedHooks(),
    listProductProfiles(),
  ])
  return (
    <SlideshowLibrary
      initialProjects={initialProjects}
      initialHooks={initialHooks}
      initialProducts={initialProducts}
    />
  )
}
