import {
  generatedSlideSchema,
  generatedSlideshowSchema,
  generationRequestSchema,
  slideOutputJsonSchema,
  slideshowOutputJsonSchema,
} from "@/lib/ai/slideshow-generation"
import {
  createGenerationPrompt,
  SLIDESHOW_SYSTEM_PROMPT,
} from "@/lib/ai/slideshow-prompt"

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_API_VERSION = "2023-06-01"
const DEFAULT_MODEL = "claude-haiku-4-5-20251001"

type AnthropicMessage = {
  content?: Array<{ type?: string; text?: string }>
  error?: { message?: string }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "Add ANTHROPIC_API_KEY to .env.local, then restart the app." },
      { status: 503 }
    )
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return Response.json(
      { error: "The request body must be JSON." },
      { status: 400 }
    )
  }

  const parsedRequest = generationRequestSchema.safeParse(input)
  if (!parsedRequest.success) {
    return Response.json(
      { error: "Check the prompt and slideshow settings, then try again." },
      { status: 400 }
    )
  }

  const generationRequest = parsedRequest.data
  const isSlideshow = generationRequest.mode === "slideshow"

  let providerResponse: Response
  try {
    providerResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: isSlideshow ? 2400 : 700,
        system: SLIDESHOW_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: createGenerationPrompt(generationRequest),
          },
        ],
        output_config: {
          format: {
            type: "json_schema",
            schema: isSlideshow
              ? slideshowOutputJsonSchema
              : slideOutputJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Claude took too long to respond. Try again."
        : "Could not reach Claude. Check your connection and try again."
    return Response.json({ error: message }, { status: 502 })
  }

  const providerBody = (await providerResponse.json()) as AnthropicMessage
  if (!providerResponse.ok) {
    const status = providerResponse.status === 429 ? 429 : 502
    const message =
      providerResponse.status === 401
        ? "The Anthropic API key was rejected. Check .env.local."
        : providerResponse.status === 429
          ? "Claude is receiving too many requests. Wait a moment and retry."
          : providerBody.error?.message ||
            "Claude could not generate the slides."

    return Response.json({ error: message }, { status })
  }

  const text = providerBody.content?.find(
    (block) => block.type === "text" && typeof block.text === "string"
  )?.text

  if (!text) {
    return Response.json(
      { error: "Claude returned an empty response. Try again." },
      { status: 502 }
    )
  }

  let generated: unknown
  try {
    generated = JSON.parse(text)
  } catch {
    return Response.json(
      { error: "Claude returned an unreadable response. Try again." },
      { status: 502 }
    )
  }

  const outputSchema = isSlideshow
    ? generatedSlideshowSchema
    : generatedSlideSchema
  const parsedOutput = outputSchema.safeParse(generated)

  if (!parsedOutput.success) {
    return Response.json(
      { error: "Claude returned incomplete slide copy. Try again." },
      { status: 502 }
    )
  }

  if (
    isSlideshow &&
    "slides" in parsedOutput.data &&
    parsedOutput.data.slides.length !== generationRequest.slideCount
  ) {
    return Response.json(
      { error: "Claude returned the wrong number of slides. Try again." },
      { status: 502 }
    )
  }

  return Response.json({ data: parsedOutput.data })
}
