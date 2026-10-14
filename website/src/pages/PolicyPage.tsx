import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiBaseUrl, site } from '@/config'
import { usePageTitle } from '@/hooks/usePageTitle'

// Listed in the side menu.
const NAV_PAGES: Record<string, string> = {
  ...Object.fromEntries(site.policies.map((p) => [p.slug, p.title])),
  about: 'About us',
  contact: 'Contact us',
}
// Every CMS page the site can show.
const PAGES: Record<string, string> = { ...NAV_PAGES, faq: 'FAQs', rider_privacy: 'Rider Privacy Policy' }

type Block = { kind: 'heading' | 'text'; text: string } | { kind: 'list'; items: string[] }

type State =
  | { status: 'loading' }
  | { status: 'ready'; title: string; blocks: Block[]; updated: string | null }
  | { status: 'message'; text: string }

const NOT_PUBLISHED = 'This page has not been published yet. Please check back soon.'
const HEADING = /^\d+\.\s+\S.{0,90}$/
const BULLET = /^[•-]\s+/

/** Blank lines separate blocks; a lone "N. Title" line is a heading and a block of "• " lines is a list. */
function parseBlocks(content: string): Block[] {
  return content.split(/\n\s*\n/).map((raw): Block => {
    const block = raw.trim()
    const lines = block.split('\n').map((l) => l.trim())
    if (lines.length === 1 && HEADING.test(block)) return { kind: 'heading', text: block }
    if (lines.every((l) => BULLET.test(l))) return { kind: 'list', items: lines.map((l) => l.replace(BULLET, '')) }
    return { kind: 'text', text: block }
  })
}

/** A page from the admin panel's CMS (plain text). */
export function PolicyPage() {
  const { slug = '' } = useParams()
  const known = slug in PAGES
  const [state, setState] = useState<State>({ status: 'loading' })
  const title = state.status === 'ready' ? state.title : known ? PAGES[slug] : 'Page not found'
  usePageTitle(title)

  useEffect(() => {
    if (!known) {
      setState({ status: 'message', text: 'This page does not exist.' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetch(`${apiBaseUrl}/common/cms/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return setState({ status: 'message', text: NOT_PUBLISHED })
        if (!response.ok) throw new Error(String(response.status))
        const page = (await response.json()) as { title?: string; content?: string; updatedAt?: string }
        const content = (page.content ?? '').trim()
        if (!content) return setState({ status: 'message', text: NOT_PUBLISHED })
        setState({
          status: 'ready',
          title: page.title || PAGES[slug],
          blocks: parseBlocks(content),
          updated: page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
        })
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setState({ status: 'message', text: 'Could not load this page. Please check your connection and try again.' })
      })
    return () => controller.abort()
  }, [slug, known])

  return (
    <>
      <section className="bg-ink-950 py-12 text-white">
        <div className="container-x max-w-5xl">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-gold-400">
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
            {state.status === 'ready' &&
              state.blocks.map((block, i) =>
                block.kind === 'heading' ? (
                  <h2 key={i}>{block.text}</h2>
                ) : block.kind === 'list' ? (
                  <ul key={i}>
                    {block.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={i} className="whitespace-pre-line">
                    {block.text}
                  </p>
                ),
              )}
          </article>
          <aside>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Policies</h2>
            <nav className="mt-3 flex flex-col gap-1 text-sm" aria-label="Policies">
              {Object.entries(NAV_PAGES).map(([key, label]) => (
                <Link
                  key={key}
                  to={`/policy/${key}`}
                  aria-current={key === slug ? 'page' : undefined}
                  className={key === slug ? 'rounded-lg bg-gold-100 px-3 py-2 font-medium text-ink-900' : 'rounded-lg px-3 py-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900'}
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
