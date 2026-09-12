import { imageSearchRequestSchema } from "@/lib/images/image-provider"
import { PinterestProvider } from "@/lib/images/providers/pinterest"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")
  const parsedRequest = imageSearchRequestSchema.safeParse({ query })
  if (!parsedRequest.success) {
    return Response.json(
      { error: "Enter at least two characters to search for images." },
      { status: 400 }
    )
  }

  const apiToken = process.env.APIFY_API
  if (!apiToken) {
    return Response.json(
      { error: "Add APIFY_API to .env.local, then restart the app." },
      { status: 503 }
    )
  }

  try {
    const provider = new PinterestProvider(apiToken)
    const results = await provider.search(parsedRequest.data.query)
    return Response.json({ data: { results } })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while searching Pinterest.",
      },
      { status: 502 }
    )
  }
}
