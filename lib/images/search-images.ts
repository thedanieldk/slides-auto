import {
  imageSearchResponseSchema,
  type ImageSearchResult,
} from "@/lib/images/image-provider"

export async function searchImages(
  query: string,
  limit?: number
): Promise<ImageSearchResult[]> {
  const params = new URLSearchParams({ query: query.trim() })
  if (limit) params.set("limit", String(limit))

  const response = await fetch(`/api/images/search?${params}`)
  const payload: unknown = await response.json()
  const responseBody = isRecord(payload) ? payload : {}

  if (!response.ok) {
    throw new Error(
      typeof responseBody.error === "string"
        ? responseBody.error
        : "Pinterest could not complete the image search."
    )
  }

  const parsedResponse = imageSearchResponseSchema.safeParse(responseBody.data)
  if (!parsedResponse.success) {
    throw new Error("Pinterest returned an unexpected response. Try again.")
  }

  return parsedResponse.data.results
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
