import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SliderProps {
  /** Accessible name of the carousel, e.g. "Highlights". */
  label: string
  slides: ReactNode[]
  /** Time each slide stays before moving on. */
  intervalMs?: number
}

const SWIPE_PX = 50

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Auto-playing carousel: arrows, dots, swipe and arrow keys. It pauses while hovered or focused,
 * and does not auto-play for people who ask for reduced motion.
 */
export function Slider({ label, slides, intervalMs = 5000 }: SliderProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragStart = useRef<number | null>(null)
  const count = slides.length

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count])

  useEffect(() => {
    if (paused || count < 2 || prefersReducedMotion()) return
    const timer = setTimeout(() => go(index + 1), intervalMs)
    return () => clearTimeout(timer)
  }, [index, paused, count, intervalMs, go])

  function onPointerUp(clientX: number) {
    if (dragStart.current === null) return
    const delta = clientX - dragStart.current
    dragStart.current = null
    if (Math.abs(delta) > SWIPE_PX) go(index + (delta < 0 ? 1 : -1))
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1)
        if (e.key === 'ArrowRight') go(index + 1)
      }}
    >
      <div
        className="touch-pan-y overflow-hidden rounded-3xl"
        onPointerDown={(e) => {
          dragStart.current = e.clientX
        }}
        onPointerUp={(e) => onPointerUp(e.clientX)}
        onPointerCancel={() => {
          dragStart.current = null
        }}
      >
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className="w-full shrink-0"
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-md transition hover:bg-white sm:flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-md transition hover:bg-white sm:flex"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          <div className="mt-4 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-brand-500' : 'w-2 bg-ink-200 hover:bg-ink-400'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
