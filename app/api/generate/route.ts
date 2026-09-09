import { requestAnthropicJson } from "@/lib/ai/anthropic"
import {
  conceptsOutputJsonSchema,
  generatedConceptResponseSchema,
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

export async function POST(request: Request) {
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
      { error: "Check the product and slideshow settings, then try again." },
      { status: 400 }
    )
  }

  const generationRequest = parsedRequest.data
  const maxTokens =
    generationRequest.mode === "concepts"
      ? 1400
      : generationRequest.mode === "slideshow"
        ? 2400
        : 700
  const outputJsonSchema =
    generationRequest.mode === "concepts"
      ? conceptsOutputJsonSchema
      : generationRequest.mode === "slideshow"
        ? slideshowOutputJsonSchema
        : slideOutputJsonSchema
  const providerResult = await requestAnthropicJson({
    maxTokens,
    system: SLIDESHOW_SYSTEM_PROMPT,
    prompt: createGenerationPrompt(generationRequest),
    schema: outputJsonSchema,
  })

  if (!providerResult.ok) {
    return Response.json(
      { error: providerResult.error },
      { status: providerResult.status }
    )
  }

  const outputSchema =
    generationRequest.mode === "concepts"
      ? generatedConceptResponseSchema
      : generationRequest.mode === "slideshow"
        ? generatedSlideshowSchema
        : generatedSlideSchema
  const parsedOutput = outputSchema.safeParse(providerResult.data)
  if (!parsedOutput.success) {
    console.error(
      `[generate:${generationRequest.mode}] Claude output validation failed`,
      parsedOutput.error.issues
    )

    const error =
      generationRequest.mode === "concepts"
        ? "Claude returned incomplete concepts. Try again."
        : generationRequest.mode === "slideshow"
          ? "Claude returned incomplete slide copy. Try again."
          : "Claude returned an incomplete slide rewrite. Try again."

    return Response.json({ error }, { status: 502 })
  }

  if (
    generationRequest.mode === "slideshow" &&
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
