import { Link, Navigate, useParams } from 'react-router-dom'
import { site } from '@/config'
import { CmsBlocks } from '@/components/CmsBlocks'
import { useCmsPage } from '@/hooks/useCmsPage'
import { usePageTitle } from '@/hooks/usePageTitle'

// Listed in the side menu.
const NAV_PAGES: Record<string, string> = Object.fromEntries(site.policies.map((p) => [p.slug, p.title]))
// Every CMS page the site can show here.
const PAGES: Record<string, string> = { ...NAV_PAGES, faq: 'FAQs', rider_privacy: 'Rider Privacy Policy' }
// CMS pages that have their own page on the site.
const MOVED: Record<string, string> = { about: '/about', contact: '/contact' }

/** A page from the admin panel's CMS (plain text). */
export function PolicyPage() {
  const { slug = '' } = useParams()
  const known = slug in PAGES
  const state = useCmsPage(known ? slug : null)
  const title = state.status === 'ready' ? state.title || PAGES[slug] : known ? PAGES[slug] : 'Page not found'
  usePageTitle(title)

  if (slug in MOVED) return <Navigate to={MOVED[slug]} replace />

  return (
    <>
      <section className="bg-ink-950 py-12 text-white">
        <div className="container-x max-w-5xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-brand-400">
            ← Home
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {state.status === 'ready' && state.updated && <p className="mt-2 text-sm text-white/50">Last updated {state.updated}</p>}
        </div>
      </section>

      <section className="py-12">
        <div className="container-x grid max-w-5xl gap-10 lg:grid-cols-[1fr_220px]">
          <article className="prose-policy" aria-live="polite" aria-busy={state.status === 'loading'}>
            {state.status === 'loading' && (
              <div className="space-y-3" aria-hidden>
                <div className="h-4 w-3/4 animate-pulse rounded bg-ink-100" />
                <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-ink-100" />
              </div>
            )}
            {state.status === 'message' && <p className="rounded-xl bg-ink-50 p-5 text-ink-500">{state.text}</p>}
            {state.status === 'ready' && <CmsBlocks blocks={state.blocks} />}
          </article>
          <aside>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Policies</h2>
            <nav className="mt-3 flex flex-col gap-1 text-sm" aria-label="Policies">
              {Object.entries(NAV_PAGES).map(([key, label]) => (
                <Link
                  key={key}
                  to={`/policy/${key}`}
                  aria-current={key === slug ? 'page' : undefined}
                  className={key === slug ? 'rounded-lg bg-brand-100 px-3 py-2 font-medium text-ink-900' : 'rounded-lg px-3 py-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900'}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </section>
    </>
  )
}
