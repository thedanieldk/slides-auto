const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_API_VERSION = "2023-06-01"
const DEFAULT_MODEL = "claude-haiku-4-5-20251001"

type AnthropicMessage = {
  content?: Array<{
    type?: string
    text?: string
    content?: { type?: string; error_code?: string }
  }>
  error?: { message?: string }
}

type AnthropicJsonResult =
  { ok: true; data: unknown } | { ok: false; error: string; status: number }

export async function requestAnthropicJson({
  maxTokens,
  prompt,
  schema,
  system,
  tools,
  requireWebFetch = false,
}: {
  maxTokens: number
  prompt: string
  schema: unknown
  system: string
  tools?: readonly unknown[]
  requireWebFetch?: boolean
}): Promise<AnthropicJsonResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: "Add ANTHROPIC_API_KEY to .env.local, then restart the app.",
      status: 503,
    }
  }

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
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: { type: "json_schema", schema },
        },
        ...(tools ? { tools } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "TimeoutError"
          ? "Claude took too long to respond. Try again."
          : "Could not reach Claude. Check your connection and try again.",
      status: 502,
    }
  }

  let providerBody: AnthropicMessage = {}
  try {
    providerBody = (await providerResponse.json()) as AnthropicMessage
  } catch {
    // The status-specific message below is more useful than a JSON parse error.
  }

  if (!providerResponse.ok) {
    return {
      ok: false,
      status: providerResponse.status === 429 ? 429 : 502,
      error:
        providerResponse.status === 401
          ? "The Anthropic API key was rejected. Check .env.local."
          : providerResponse.status === 429
            ? "Claude is receiving too many requests. Wait a moment and retry."
            : providerBody.error?.message ||
              "Claude could not complete the request.",
    }
  }

  if (requireWebFetch) {
    const fetchResult = providerBody.content?.find(
      (block) => block.type === "web_fetch_tool_result"
    )
    if (!fetchResult) {
      return {
        ok: false,
        error: "Claude could not read that product page. Try another link.",
        status: 422,
      }
    }

    if (fetchResult.content?.type === "web_fetch_tool_error") {
      return {
        ok: false,
        error: getWebFetchError(fetchResult.content.error_code),
        status: 422,
      }
    }
  }

  const text = providerBody.content
    ?.filter(
      (block): block is typeof block & { text: string } =>
        block.type === "text" && typeof block.text === "string"
    )
    .at(-1)?.text
  if (!text) {
    return {
      ok: false,
      error: "Claude returned an empty response. Try again.",
      status: 502,
    }
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown }
  } catch {
    return {
      ok: false,
      error: "Claude returned an unreadable response. Try again.",
      status: 502,
    }
  }
}

function getWebFetchError(errorCode: string | undefined) {
  switch (errorCode) {
    case "invalid_input":
    case "url_too_long":
      return "Enter a shorter, valid product website URL."
    case "url_not_allowed":
      return "Claude is not allowed to open that product page."
    case "unsupported_content_type":
      return "That link is not a supported webpage or PDF."
    case "too_many_requests":
      return "The product page is receiving too many requests. Try again later."
    case "url_not_accessible":
      return "Claude could not access that product page."
    default:
      return "Claude could not read that product page. Try another link."
  }
}
