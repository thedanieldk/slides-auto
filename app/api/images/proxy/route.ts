const ALLOWED_HOSTS = new Set(["i.pinimg.com"])

/**
 * Streams an allow-listed image through our own origin. Pinterest's CDN
 * sends no Access-Control-Allow-Origin header, so canvas exports
 * (html-to-image) taint and produce a blank image for any slide background
 * fetched directly from it. Routing through this same-origin endpoint
 * avoids that entirely.
 */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url")
  if (!url) {
    return Response.json({ error: "Missing url parameter." }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return Response.json({ error: "Invalid url." }, { status: 400 })
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return Response.json(
      { error: "That host is not allowed." },
      { status: 400 }
    )
  }

  let response: Response
  try {
    response = await fetch(target, { signal: AbortSignal.timeout(15_000) })
  } catch {
    return Response.json(
      { error: "Could not reach the image host." },
      { status: 502 }
    )
  }

  if (!response.ok || !response.body) {
    return Response.json(
      { error: "Could not fetch the image." },
      { status: 502 }
    )
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=86400, immutable",
    },
  })
}
