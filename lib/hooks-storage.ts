import type { CompositionResult } from "@/lib/composition"

export type SavedHook = {
  id: string
  text: string
  frameworkId: string
  productId: string | null
  createdAt: string
  generatedCopy?: CompositionResult
}
