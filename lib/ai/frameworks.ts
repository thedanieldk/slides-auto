import type { CopyFormatId } from "@/lib/ai/copy-formats"

export const hookFrameworkIds = [
  "five-step",
  "change-list",
  "routine-coach",
] as const

export type HookFrameworkId = (typeof hookFrameworkIds)[number]

export type HookFramework = {
  id: HookFrameworkId
  name: string
  description: string
  exampleTitle: string
  exampleSlide: string
  copyFormatId: CopyFormatId
  /** Number of items promised in the title (e.g. the "5" in "5 ways I..."). */
  itemCount: number
  /** Total slides, including the dedicated title slide. */
  slideCount: number
  /**
   * Whether the title promises a specific count ("5 ways I...") and the
   * items themselves are written as a numbered list. False for formats
   * whose title reads like a plain personal story with unnumbered items.
   */
  numberedList: boolean
}

export const hookFrameworks: readonly HookFramework[] = [
  {
    id: "five-step",
    name: "5-Step",
    description:
      "A dedicated title slide, then 5 numbered items you personally did, one per slide.",
    exampleTitle: "5 ways I finally fixed my sleep schedule for good",
    exampleSlide:
      "1. I stopped scrolling in bed. Honestly my phone was keeping me wired way past midnight, now I plug it in across the room at 10pm.",
    copyFormatId: "personal-results",
    itemCount: 5,
    slideCount: 6,
    numberedList: true,
  },
  {
    id: "change-list",
    name: "Change List",
    description:
      "A dedicated title slide, then short, unnumbered changes you personally made, one per slide.",
    exampleTitle: "How I stopped going to bed at 2am",
    exampleSlide: "Same wake-up time",
    copyFormatId: "change-list",
    itemCount: 6,
    slideCount: 7,
    numberedList: false,
  },
  {
    id: "routine-coach",
    name: "Routine Coach",
    description:
      "A dedicated title slide naming the routine and who it's for, then direct step-by-step coaching, one per slide.",
    exampleTitle:
      "Winter night routine: for the girls trying to wake up at 5am",
    exampleSlide:
      "MINDSET MATTERS!!! Go to bed telling yourself you can't wait to move your body tomorrow, not just hoping you'll wake up.",
    copyFormatId: "routine-coach",
    itemCount: 7,
    slideCount: 8,
    numberedList: false,
  },
]

export function getHookFramework(id: HookFrameworkId): HookFramework {
  return (
    hookFrameworks.find((framework) => framework.id === id) ??
    hookFrameworks[0]!
  )
}
