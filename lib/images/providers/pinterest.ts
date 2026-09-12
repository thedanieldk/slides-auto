import type {
  ImageProvider,
  ImageSearchResult,
} from "@/lib/images/image-provider"

const PINTEREST_ACTOR_URL =
  "https://api.apify.com/v2/actors/fatihtahta~pinterest-scraper-search/run-sync-get-dataset-items"

type PinterestImage = {
  url?: string
}

type PinterestPin = {
  id?: string
  url?: string
  title?: string
  pin?: {
    title?: string
    is_promoted?: boolean
  }
  creator?: {
    username?: string
    full_name?: string
    url?: string
  }
  media?: {
    images?: {
      original?: PinterestImage
      large?: PinterestImage
      medium?: PinterestImage
    }
  }
}

export class PinterestProvider implements ImageProvider {
  constructor(private readonly apiToken: string) {}

  async search(query: string): Promise<ImageSearchResult[]> {
    const url = new URL(PINTEREST_ACTOR_URL)
    url.searchParams.set("token", this.apiToken)

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queries: [query],
        type: "all-pins",
        limit: 20,
      }),
      signal: AbortSignal.timeout(45_000),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("The Apify API token was rejected. Check .env.local.")
      }
      if (response.status === 429) {
        throw new Error("Pinterest search limit reached. Try again later.")
      }
      throw new Error("Pinterest could not complete the image search.")
    }

    const pins = (await response.json()) as PinterestPin[]
    return pins.flatMap(toImageSearchResult)
  }
}

function toImageSearchResult(pin: PinterestPin): ImageSearchResult[] {
  if (pin.pin?.is_promoted) return []

  const id = pin.id
  const photographer =
    pin.creator?.full_name?.trim() || pin.creator?.username?.trim()
  const photographerUrl = pin.creator?.url
  const photoUrl = pin.url
  const previewUrl = pin.media?.images?.medium?.url
  const imageUrl =
    pin.media?.images?.original?.url ?? pin.media?.images?.large?.url

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
      alt: (pin.title || pin.pin?.title || "Pinterest photo").trim(),
      photographer,
      photographerUrl,
      photoUrl,
      previewUrl,
      imageUrl,
      provider: "pinterest",
    },
  ]
}
