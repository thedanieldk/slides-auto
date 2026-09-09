export const copyFormatIds = [
  "smart",
  "personal-results",
  "helpful-habits",
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
    case "smart":
      return `Choose whichever of these structures best fits the topic: Personal Results List or Helpful Habits List. Follow that structure consistently. If the topic does not provide real personal experience or a product, do not invent either one.`
  }
}
