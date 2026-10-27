import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { site } from '@/config'
import { PageHero } from '@/components/PageHero'
import { usePageTitle } from '@/hooks/usePageTitle'

type Photo = (typeof site.gallery)[number]

const ALL = 'All'
const CATEGORIES = [ALL, ...new Set(site.gallery.map((p) => p.category))]

const LOGOS = [
  { src: `${import.meta.env.BASE_URL}brand/anz-logo.png`, title: 'Full logo', note: 'For light backgrounds', width: 800, height: 490 },
  { src: `${import.meta.env.BASE_URL}brand/anz-icon.png`, title: 'App icon', note: 'Square mark', width: 512, height: 512 },
  { src: `${import.meta.env.BASE_URL}brand/anz-og.png`, title: 'Wide banner', note: 'For social posts and link previews', width: 1200, height: 630 },
]

/** Full-screen view of one photo; arrow keys move between photos and Esc closes. */
function Lightbox({ photos, index, onChange, onClose }: { photos: Photo[]; index: number; onChange: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const photo = photos[index]
  const go = (step: number) => onChange((index + step + photos.length) % photos.length)

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
      aria-label={photo.caption}
      className="m-auto max-h-none max-w-none bg-transparent p-4 backdrop:bg-ink-950/90"
    >
      <figure className="relative mx-auto w-[min(92vw,1100px)]">
        <img src={photo.src} alt={photo.alt} className="max-h-[78vh] w-full rounded-2xl bg-white object-contain" />
        <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-white/80">
          <span>{photo.caption}</span>
          <span className="shrink-0 text-white/50">
            {index + 1} / {photos.length}
          </span>
        </figcaption>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-[calc(50%-1.25rem)] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-md hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-[calc(50%-1.25rem)] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-md hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </figure>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </dialog>
  )
}

export function GalleryPage() {
  usePageTitle('Gallery')
  const [category, setCategory] = useState(ALL)
  const [open, setOpen] = useState<number | null>(null)
  const photos = category === ALL ? site.gallery : site.gallery.filter((p) => p.category === category)

  return (
    <>
      <PageHero eyebrow="Gallery" title="AnZ Cabs on the move">
        Rides, deliveries and the app that brings them together.
      </PageHero>

      <section className="py-16">
        <div className="container-x">
          {CATEGORIES.length > 2 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter photos">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={c === category}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${c === category ? 'bg-ink-950 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, i) => (
              <li key={photo.src}>
                <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-2xl border border-ink-100 bg-white text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400">
                  <span className="block aspect-[3/2] overflow-hidden bg-ink-50">
                    <img src={photo.src} alt={photo.alt} loading="lazy" width={1200} height={800} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </span>
                  <span className="flex items-center justify-between gap-3 p-4">
                    <span className="font-medium text-ink-900">{photo.caption}</span>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">{photo.category}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="logos" className="bg-ink-50 py-20">
        <div className="container-x">
          <p className="eyebrow">Brand</p>
          <h2 className="section-title mt-2">Our logos</h2>
          <p className="mt-3 max-w-2xl text-ink-500">Use these for press, partner listings and anything that features {site.name}. Please don't stretch, recolour or change them.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LOGOS.map((logo) => (
              <li key={logo.src} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex h-52 items-center justify-center border-b border-ink-100 p-6">
                  <img src={logo.src} alt={`${site.name} ${logo.title.toLowerCase()}`} width={logo.width} height={logo.height} loading="lazy" className="h-full w-full object-contain" />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-ink-900">{logo.title}</p>
                    <p className="text-xs text-ink-500">{logo.note}</p>
                  </div>
                  <a href={logo.src} download className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-ink-700">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    PNG
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {open !== null && <Lightbox photos={photos} index={open} onChange={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
