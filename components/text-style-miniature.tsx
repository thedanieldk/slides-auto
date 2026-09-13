import { cn } from "@/lib/utils"
import type { TextStyleId } from "@/lib/slideshow"

export function TextStyleMiniature({
  textStyleId,
}: {
  textStyleId: TextStyleId
}) {
  return (
    <span className="relative block aspect-[9/6] overflow-hidden rounded-lg bg-[linear-gradient(145deg,#8e8478,#3f453d)] ring-1 ring-black/8">
      <span
        className={cn(
          "absolute block",
          textStyleId === "clean-white" &&
            "top-[30%] right-[16%] left-[16%] h-1.5 bg-white",
          textStyleId === "soft-yellow" &&
            "top-[24%] right-[38%] left-[9%] h-1 bg-[#fff58f]",
          textStyleId === "yellow-cover" &&
            "top-[24%] right-[12%] left-[12%] h-5 bg-[#fff58f]",
          textStyleId === "label-body" &&
            "top-[22%] right-[13%] left-[13%] h-4 rounded bg-white"
        )}
      />
      <span
        className={cn(
          "absolute block h-1",
          textStyleId === "clean-white" &&
            "top-[45%] right-[26%] left-[26%] bg-white/80",
          textStyleId === "soft-yellow" &&
            "top-[38%] right-[28%] left-[9%] bg-[#fff58f]/80",
          textStyleId === "yellow-cover" &&
            "top-[62%] right-[32%] left-[32%] bg-white/90",
          textStyleId === "label-body" &&
            "top-[55%] right-[24%] left-[24%] bg-white/85"
        )}
      />
    </span>
  )
}
