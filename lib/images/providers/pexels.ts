import type {
  ImageProvider,
  ImageSearchResult,
} from "@/lib/images/image-provider"

const PEXELS_API_URL = "https://api.pexels.com/v1/search"

type PexelsPhoto = {
  id?: number
  alt?: string
  photographer?: string
  photographer_url?: string
  url?: string
  src?: {
    medium?: string
    portrait?: string
    large2x?: string
    original?: string
  }
}

type PexelsResponse = {
  photos?: PexelsPhoto[]
}

export class PexelsProvider implements ImageProvider {
  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<ImageSearchResult[]> {
    const url = new URL(PEXELS_API_URL)
    url.searchParams.set("query", query)
    url.searchParams.set("orientation", "portrait")
    url.searchParams.set("size", "medium")
    url.searchParams.set("per_page", "12")

    const response = await fetch(url, {
      headers: { Authorization: this.apiKey },
      signal: AbortSignal.timeout(12_000),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("The Pexels API key was rejected. Check .env.local.")
      }
      if (response.status === 429) {
        throw new Error("Pexels search limit reached. Try again later.")
      }
      throw new Error("Pexels could not complete the image search.")
    }

    const payload = (await response.json()) as PexelsResponse
    return (payload.photos ?? []).flatMap(toImageSearchResult)
  }
}

function toImageSearchResult(photo: PexelsPhoto): ImageSearchResult[] {
  const id = photo.id?.toString()
  const photographer = photo.photographer?.trim()
  const photographerUrl = photo.photographer_url
  const photoUrl = photo.url
  const previewUrl = photo.src?.medium ?? photo.src?.portrait
  const imageUrl =
    photo.src?.portrait ?? photo.src?.large2x ?? photo.src?.original

  if (
    !id ||
    !photographer ||
    !photographerUrl ||
    !photoUrl ||
    !previewUrl ||
    !imageUrl
  ) {
    return []
  }

  return [
    {
      id,
      alt: photo.alt?.trim() || "Pexels photo",
      photographer,
      photographerUrl,
      photoUrl,
      previewUrl,
      imageUrl,
      provider: "pexels",
    },
  ]
}
