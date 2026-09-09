"use client"

import { ImageIcon, LoaderCircle, Search, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { searchImages } from "@/lib/images/search-images"
import type { ImageSearchResult } from "@/lib/images/image-provider"
import type { SlideImage } from "@/lib/slideshow"

type ImageSearchDialogProps = {
  open: boolean
  initialQuery: string
  onClose: () => void
  onSelect: (image: SlideImage) => void
}

export function ImageSearchDialog({
  open,
  initialQuery,
  onClose,
  onSelect,
}: ImageSearchDialogProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (nextQuery: string) => {
    const cleanQuery = nextQuery.trim()
    if (cleanQuery.length < 2) {
      setError("Enter at least two characters to search.")
      return
    }

    setIsSearching(true)
    setError(null)
    try {
      setResults(await searchImages(cleanQuery))
    } catch (searchError) {
      setResults([])
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching for images."
      )
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const initializeSearch = window.setTimeout(() => {
      setQuery(initialQuery)
      setResults([])
      setError(null)
      if (initialQuery.trim().length >= 2) void runSearch(initialQuery)
    }, 0)

    return () => window.clearTimeout(initializeSearch)
  }, [initialQuery, open, runSearch])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    if (open) window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  function chooseImage(result: ImageSearchResult) {
    onSelect({
      id: `pexels-${result.id}`,
      name: result.alt || "Pexels photo",
      dataUrl: result.imageUrl,
      source: {
        provider: "pexels",
        photographer: result.photographer,
        photographerUrl: result.photographerUrl,
        photoUrl: result.photoUrl,
      },
    })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[#171820]/55 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onClose()
          }}
        >
          <motion.section
            aria-label="Search photos"
            aria-modal="true"
            role="dialog"
            className="flex max-h-[90svh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-black/10 bg-[#f8f7f4] shadow-[0_30px_100px_rgba(15,16,24,.35)]"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium text-[#4758c7]">
                  Slide image
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">Find a photo</h2>
              </div>
              <Button
                aria-label="Close image search"
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X />
              </Button>
            </div>

            <form
              className="flex gap-2 px-5 py-4 sm:px-6"
              onSubmit={(event) => {
                event.preventDefault()
                void runSearch(query)
              }}
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Photo search</span>
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-black/35" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="woman reading in bed"
                  className="h-10 w-full rounded-xl border border-black/10 bg-white pr-3 pl-10 text-sm transition outline-none focus:border-[#4758c7] focus:ring-3 focus:ring-[#4758c7]/10"
                />
              </label>
              <Button type="submit" className="h-10 px-4">
                {isSearching ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Search />
                )}
                Search
              </Button>
            </form>

            <div className="min-h-80 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {!error && isSearching && results.length === 0 && (
                <div className="grid min-h-80 place-items-center text-center text-black/45">
                  <div>
                    <LoaderCircle className="mx-auto mb-3 size-6 animate-spin" />
                    <p className="text-sm">Finding portrait photos…</p>
                  </div>
                </div>
              )}

              {!error && !isSearching && results.length === 0 && (
                <div className="grid min-h-80 place-items-center text-center text-black/45">
                  <div>
                    <ImageIcon className="mx-auto mb-3 size-7" />
                    <p className="text-sm">
                      Search for a scene you can picture.
                    </p>
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {results.map((result) => (
                    <motion.button
                      layout
                      key={result.id}
                      type="button"
                      aria-label={`Use image: ${result.alt}`}
                      onClick={() => chooseImage(result)}
                      className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#ddd8cf] text-left ring-1 ring-black/10 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4758c7]"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                    >
                      <span
                        className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.025]"
                        style={{
                          backgroundImage: `url(${JSON.stringify(result.previewUrl)})`,
                        }}
                      />
                      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <span className="absolute right-2 bottom-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold opacity-0 shadow-sm transition group-hover:opacity-100">
                        Use photo
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
