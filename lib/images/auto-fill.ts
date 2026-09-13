import { searchImages } from "@/lib/images/search-images"
import {
  DEFAULT_IMAGE_QUERY,
  type ImageSearchResult,
} from "@/lib/images/image-provider"
import type { SlideImage, SlideshowSlide } from "@/lib/slideshow"

export type AutoFillResult = {
  slides: SlideshowSlide[]
  filledCount: number
  failedCount: number
}

async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= items.length) return
      try {
        results[index] = {
          status: "fulfilled",
          value: await task(items[index]!),
        }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  return results
}

function toSlideImage(result: ImageSearchResult): SlideImage {
  return {
    id: `pinterest-${result.id}`,
    name: result.alt || "Pinterest photo",
    dataUrl: result.imageUrl,
    source: {
      provider: "pinterest",
      photographer: result.photographer,
      photographerUrl: result.photographerUrl,
      photoUrl: result.photoUrl,
    },
  }
}

/**
 * Fills in a background image for every slide missing one. Slides commonly
 * share a query (from the same product's per-slideshow image-query
 * generation), so this groups by distinct query and searches once per
 * group instead of once per slide, with a concurrency cap since firing
 * every group's search in parallel can exceed Apify's concurrent-run limit.
 */
export async function autoFillSlideImages(
  slides: SlideshowSlide[]
): Promise<AutoFillResult> {
  const targets = slides.flatMap((slide) => {
    const query = slide.imageQuery?.trim() || DEFAULT_IMAGE_QUERY
    return !slide.image ? [{ slide, query }] : []
  })

  if (targets.length === 0) {
    return { slides, filledCount: 0, failedCount: 0 }
  }

  const usedImageIds = new Set(
    slides.flatMap((slide) =>
      slide.image?.id.startsWith("pinterest-") ? [slide.image.id] : []
    )
  )

  const groups = new Map<string, SlideshowSlide[]>()
  for (const { slide, query } of targets) {
    const group = groups.get(query)
    if (group) {
      group.push(slide)
    } else {
      groups.set(query, [slide])
    }
  }

  const groupEntries = Array.from(groups.entries())
  const searches = await runWithConcurrencyLimit(
    groupEntries,
    2,
    async ([query, groupSlides]) => ({
      slides: groupSlides,
      results: await searchImages(query, Math.min(groupSlides.length + 3, 20)),
    })
  )

  const selectedImages = new Map<string, SlideImage>()
  let failedCount = 0

  for (const [index, search] of searches.entries()) {
    if (search.status === "rejected") {
      console.error("Pinterest search failed during auto-fill:", search.reason)
      failedCount += groupEntries[index]![1].length
      continue
    }

    const [query] = groupEntries[index]!
    const { slides: groupSlides, results } = search.value
    for (const slide of groupSlides) {
      const result = results.find(
        (candidate) => !usedImageIds.has(`pinterest-${candidate.id}`)
      )
      if (!result) {
        console.error(
          `Pinterest search for "${query}" returned ${results.length} results, none usable (all already used or none found)`
        )
        failedCount += 1
        continue
      }

      const image = toSlideImage(result)
      usedImageIds.add(image.id)
      selectedImages.set(slide.id, image)
    }
  }

  const updatedSlides = slides.map((slide) =>
    selectedImages.has(slide.id)
      ? { ...slide, image: selectedImages.get(slide.id)! }
      : slide
  )

  return {
    slides: updatedSlides,
    filledCount: selectedImages.size,
    failedCount,
  }
}
