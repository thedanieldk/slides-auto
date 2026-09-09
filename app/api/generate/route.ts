import { requestAnthropicJson } from "@/lib/ai/anthropic"
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
      { error: "Check the prompt and slideshow settings, then try again." },
      { status: 400 }
    )
  }

  const generationRequest = parsedRequest.data
  const isSlideshow = generationRequest.mode === "slideshow"
  const providerResult = await requestAnthropicJson({
    maxTokens: isSlideshow ? 2400 : 700,
    system: SLIDESHOW_SYSTEM_PROMPT,
    prompt: createGenerationPrompt(generationRequest),
    schema: isSlideshow ? slideshowOutputJsonSchema : slideOutputJsonSchema,
  })

  if (!providerResult.ok) {
    return Response.json(
      { error: providerResult.error },
      { status: providerResult.status }
    )
  }

  const outputSchema = isSlideshow
    ? generatedSlideshowSchema
    : generatedSlideSchema
  const parsedOutput = outputSchema.safeParse(providerResult.data)
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
