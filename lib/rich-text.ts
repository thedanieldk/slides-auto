export type RichTextSegment = { text: string; bold: boolean }

const BOLD_PATTERN = /\*\*(.+?)\*\*/g

export function parseRichText(value: string): RichTextSegment[] {
  const segments: RichTextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  BOLD_PATTERN.lastIndex = 0
  while ((match = BOLD_PATTERN.exec(value))) {
    if (match.index > lastIndex) {
      segments.push({ text: value.slice(lastIndex, match.index), bold: false })
    }
    segments.push({ text: match[1]!, bold: true })
    lastIndex = BOLD_PATTERN.lastIndex
  }
  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), bold: false })
  }
  return segments
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Renders `**bold**` markers as real HTML for setting `innerHTML` directly on a DOM node. */
export function richTextToHtml(value: string): string {
  return parseRichText(value)
    .map((segment) =>
      segment.bold
        ? `<strong>${escapeHtml(segment.text)}</strong>`
        : escapeHtml(segment.text)
    )
    .join("")
}

const BOLD_FONT_WEIGHTS = new Set([
  "bold",
  "bolder",
  "600",
  "700",
  "800",
  "900",
])

function isBoldElement(element: HTMLElement): boolean {
  if (element.tagName === "B" || element.tagName === "STRONG") return true
  const weight = element.style.fontWeight
  return weight ? BOLD_FONT_WEIGHTS.has(weight) : false
}

/**
 * Converts a contentEditable node's DOM tree back into plain text with
 * `**bold**` markers, so browser-native bold (Cmd/Ctrl+B, execCommand) can
 * be persisted as a plain string without storing raw HTML.
 */
export function serializeEditableNode(root: Node): string {
  let result = ""

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ""
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const element = node as HTMLElement
    if (element.tagName === "BR") {
      result += "\n"
      continue
    }

    const inner = serializeEditableNode(element)
    result += isBoldElement(element) && inner.trim() ? `**${inner}**` : inner

    if (element.tagName === "DIV" || element.tagName === "P") {
      result += "\n"
    }
  }

  return result
}
