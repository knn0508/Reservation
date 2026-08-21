import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react"

const EASE = [0.32, 0.72, 0, 1] as const

interface ImageLightboxProps {
  images: string[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
  const open = index >= 0

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length)
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length)
    }
    window.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, index, images.length, onClose, onIndexChange])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/92 backdrop-blur-md"
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-parchment-50/20 text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95"
          >
            <X size={18} weight="light" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onIndexChange((index - 1 + images.length) % images.length)
                }}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-parchment-50/20 text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95 md:left-8"
              >
                <CaretLeft size={18} weight="light" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onIndexChange((index + 1) % images.length)
                }}
                aria-label="Next image"
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-parchment-50/20 text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95 md:right-8"
              >
                <CaretRight size={18} weight="light" />
              </button>
            </>
          )}

          <div className="mx-4 max-h-[80vh] max-w-[64rem]" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              <motion.img
                key={index}
                src={images[index]}
                alt=""
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="max-h-[80vh] w-auto rounded-2xl object-contain shadow-[0_40px_120px_-24px_rgba(0,0,0,0.6)]"
              />
            </AnimatePresence>
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onIndexChange(i)
                  }}
                  aria-label={`Show image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-parchment-50" : "w-1.5 bg-parchment-50/35"
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
