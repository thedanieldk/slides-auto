export type RichTextSegment = { text: string; bold: boolean }

// [\s\S] (not ".") is required: bolding text and then pressing Enter/
// Shift+Enter mid-selection can leave a newline inside the same **...**
// span, and "." never matches "\n" - the pattern would then fail to match
// that span at all, leaking the literal "**" markers into the visible text.
const BOLD_PATTERN = /\*\*([\s\S]+?)\*\*/g

// A literal "*" typed by the user is stored as "\*" (see serializeEditableNode)
// so it can never be mistaken for one of our own "**bold**" delimiters. Before
// matching bold spans, escaped asterisks are swapped for this placeholder - a
// Unicode Private Use Area character no keyboard or font produces, so it can
// never collide with real user text - and it never contains "*" itself, so
// the regex above only ever sees real delimiters. Every placeholder is
// restored to a literal "*" afterwards in the resulting segment text.
const ESCAPED_ASTERISK_PLACEHOLDER = ""

function hideEscapedAsterisks(value: string): string {
  return value.replace(/\\\*/g, ESCAPED_ASTERISK_PLACEHOLDER)
}

function restoreEscapedAsterisks(value: string): string {
  return value.split(ESCAPED_ASTERISK_PLACEHOLDER).join("*")
}

export function parseRichText(value: string): RichTextSegment[] {
  const hidden = hideEscapedAsterisks(value)
  const segments: RichTextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  BOLD_PATTERN.lastIndex = 0
  while ((match = BOLD_PATTERN.exec(hidden))) {
    if (match.index > lastIndex) {
      segments.push({
        text: restoreEscapedAsterisks(hidden.slice(lastIndex, match.index)),
        bold: false,
      })
    }
    segments.push({
      text: restoreEscapedAsterisks(match[1]!),
      bold: true,
    })
    lastIndex = BOLD_PATTERN.lastIndex
  }
  if (lastIndex < hidden.length) {
    segments.push({
      text: restoreEscapedAsterisks(hidden.slice(lastIndex)),
      bold: false,
    })
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

function isBoldElement(element: HTMLElement): boolean {
  // Bold is only ever inserted by our own toggleBoldSelection (always a
  // <strong>), never by the browser's native execCommand - its bold-state
  // heuristic gets confused when a layer's base style is already semi-bold
  // (e.g. the hook layer's 600 weight), sometimes producing a font-weight
  // override that isn't a real bold toggle. Checking font-weight here used
  // to treat that as bold, which caused the first press to appear to do
  // nothing. Tag name alone is unambiguous.
  return element.tagName === "B" || element.tagName === "STRONG"
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
      // A literal "*" the user typed (e.g. styling a quote as **like this**
      // themselves) would otherwise be indistinguishable from our own bold
      // delimiter once this text sits inside a real <strong> from toggling
      // bold - escaping it here means parseRichText can always tell "**"
      // that means bold apart from "**" that's just part of the text.
      result += (node.textContent ?? "").replace(/\*/g, "\\*")
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
