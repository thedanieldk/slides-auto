import type { CopyFormatId } from "@/lib/ai/copy-formats"

export const hookFrameworkIds = ["five-step"] as const

export type HookFrameworkId = (typeof hookFrameworkIds)[number]

export type HookFramework = {
  id: HookFrameworkId
  name: string
  description: string
  exampleTitle: string
  exampleSlide: string
  copyFormatId: CopyFormatId
  slideCount: number
}

export const hookFrameworks: readonly HookFramework[] = [
  {
    id: "five-step",
    name: "5-Step",
    description:
      "A title that promises 5 things you personally did, then one numbered item per slide.",
    exampleTitle: "5 ways I finally fixed my sleep schedule for good",
    exampleSlide:
      "1. I stopped scrolling in bed. Honestly my phone was keeping me wired way past midnight, now I plug it in across the room at 10pm.",
    copyFormatId: "personal-results",
    slideCount: 5,
  },
]

export function getHookFramework(id: HookFrameworkId): HookFramework {
  return (
    hookFrameworks.find((framework) => framework.id === id) ??
    hookFrameworks[0]!
  )
}
