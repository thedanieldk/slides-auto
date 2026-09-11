import { requestAnthropicJson } from "@/lib/ai/anthropic"
import {
  conceptsOutputJsonSchema,
  createSlideshowOutputJsonSchema,
  generatedConceptResponseSchema,
  generatedHooksSchema,
  generatedSlideSchema,
  generatedSlideshowSchema,
  generationRequestSchema,
  hooksOutputJsonSchema,
  normalizeGeneratedHooks,
  normalizeGeneratedSlideshow,
  slideOutputJsonSchema,
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
      : generationRequest.mode === "slideshow" ||
          generationRequest.mode === "slideshow-from-hook"
        ? 2400
        : 700
  const outputJsonSchema =
    generationRequest.mode === "concepts"
      ? conceptsOutputJsonSchema
      : generationRequest.mode === "slideshow" ||
          generationRequest.mode === "slideshow-from-hook"
        ? createSlideshowOutputJsonSchema(generationRequest.slideCount)
        : generationRequest.mode === "hooks"
          ? hooksOutputJsonSchema
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
      : generationRequest.mode === "slideshow" ||
          generationRequest.mode === "slideshow-from-hook"
        ? generatedSlideshowSchema
        : generationRequest.mode === "hooks"
          ? generatedHooksSchema
          : generatedSlideSchema
  const normalizedOutput =
    generationRequest.mode === "slideshow" ||
    generationRequest.mode === "slideshow-from-hook"
      ? normalizeGeneratedSlideshow(
          providerResult.data,
          generationRequest.slideCount
        )
      : generationRequest.mode === "hooks"
        ? normalizeGeneratedHooks(providerResult.data)
        : providerResult.data
  const parsedOutput = outputSchema.safeParse(normalizedOutput)
  if (!parsedOutput.success) {
    console.error(
      `[generate:${generationRequest.mode}] Provider output validation failed`,
      parsedOutput.error.issues
    )

    const error =
      generationRequest.mode === "concepts"
        ? "The generated concepts were incomplete. Try again."
        : generationRequest.mode === "slideshow" ||
            generationRequest.mode === "slideshow-from-hook"
          ? "The generated slide copy was incomplete. Try again."
          : generationRequest.mode === "hooks"
            ? "The generated hooks were incomplete. Try again."
            : "The generated slide rewrite was incomplete. Try again."

    return Response.json({ error }, { status: 502 })
  }

  if (
    (generationRequest.mode === "slideshow" ||
      generationRequest.mode === "slideshow-from-hook") &&
    "slides" in parsedOutput.data &&
    parsedOutput.data.slides.length !== generationRequest.slideCount
  ) {
    return Response.json(
      {
        error: "The slideshow contained the wrong number of slides. Try again.",
      },
      { status: 502 }
    )
  }

  if (
    generationRequest.mode === "slideshow-from-hook" &&
    "slides" in parsedOutput.data
  ) {
    parsedOutput.data.slides[0] = {
      ...parsedOutput.data.slides[0]!,
      hook: generationRequest.hook,
    }
  }

  return Response.json({ data: parsedOutput.data })
}
