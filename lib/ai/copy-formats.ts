export const copyFormatIds = [
  "smart",
  "personal-results",
  "helpful-habits",
  "change-list",
] as const

export type CopyFormatId = (typeof copyFormatIds)[number]

export type CopyFormat = {
  id: CopyFormatId
  name: string
  description: string
  productRole: string
}

export const copyFormats = [
  {
    id: "smart",
    name: "Smart pick",
    description: "Let AI choose the structure that fits your idea.",
    productRole: "Chosen from the context",
  },
  {
    id: "personal-results",
    name: "Personal Results List",
    description: "Share what personally helped you get a specific result.",
    productRole: "Part of the personal result",
  },
  {
    id: "helpful-habits",
    name: "Helpful Habits List",
    description:
      "Give useful standalone tips with one expanded recommendation.",
    productRole: "One natural product cameo",
  },
  {
    id: "change-list",
    name: "Change List",
    description: "Short, unnumbered changes that add up to one result.",
    productRole: "One of the specific changes",
  },
] as const satisfies readonly CopyFormat[]

export function getCopyFormatInstructions(formatId: CopyFormatId) {
  switch (formatId) {
    case "personal-results":
      return `Use the Personal Results List format:
- Open with a numbered, specific result the speaker personally achieved.
- Give each numbered item its own slide.
- Build each item from a concrete action, a brief personal realization, and a specific detail when space allows.
- If the topic includes a product, make it one genuine part of how the speaker got the result. Do not turn the whole slideshow into a product pitch.
- Make sure the number promised in the hook exactly matches the numbered items that follow.`
    case "helpful-habits":
      return `Use the Helpful Habits List format:
- Open with a numbered promise of small, useful habits related to the desired outcome.
- Make most numbered items short, standalone, and a little unexpected.
- Expand one middle item into a brief personal example.
- If the topic includes a product, place it naturally inside that expanded middle item, then return to non-product value on the following slide.
- End casually and without a hard sell.
- Make sure the number promised in the hook exactly matches the numbered items that follow.`
    case "change-list":
      return `Use the Change List format:
- Open with an umbrella title that promises a whole list of separate small changes still to come, e.g. "How I stopped going to bed at 2am", "Things I stopped doing after 10pm that made me sleep better", "Weird bedtime habits I've quietly built that actually work". Never promise a number or say "N things", and never let the title itself read as a single specific action - that belongs on a later slide, not the title.
- Give each change its own slide as a short, standalone phrase, 2 to 6 words. Never a full sentence, never numbered, never explained or justified.
- Do not elaborate on any item. Trust the phrase alone, like a quick note rather than a caption.
- If the topic includes a product, let exactly one item name it naturally as one of the specific changes, not a separate pitch.`
    case "smart":
      return `Choose whichever of these structures best fits the topic: Personal Results List or Helpful Habits List. Follow that structure consistently. If the topic does not provide real personal experience or a product, do not invent either one.`
  }
}
