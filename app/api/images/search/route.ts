import { imageSearchRequestSchema } from "@/lib/images/image-provider"
import { PexelsProvider } from "@/lib/images/providers/pexels"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")
  const parsedRequest = imageSearchRequestSchema.safeParse({ query })
  if (!parsedRequest.success) {
    return Response.json(
      { error: "Enter at least two characters to search for images." },
      { status: 400 }
    )
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "Add PEXELS_API_KEY to .env.local, then restart the app." },
      { status: 503 }
    )
  }

  try {
    const provider = new PexelsProvider(apiKey)
    const results = await provider.search(parsedRequest.data.query)
    return Response.json({ data: { results } })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while searching Pexels.",
      },
      { status: 502 }
    )
  }
}
