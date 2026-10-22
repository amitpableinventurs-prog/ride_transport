import { useEffect, useState } from 'react'
import { apiBaseUrl } from '@/config'

export type CmsBlock = { kind: 'heading' | 'text'; text: string } | { kind: 'list'; items: string[] }

export type CmsState =
  | { status: 'loading' }
  | { status: 'ready'; title: string; blocks: CmsBlock[]; updated: string | null }
  | { status: 'message'; text: string }

const NOT_PUBLISHED = 'This page has not been published yet. Please check back soon.'
const HEADING = /^\d+\.\s+\S.{0,90}$/
const BULLET = /^[•-]\s+/

/** Blank lines separate blocks; a lone "N. Title" line is a heading and a block of "• " lines is a list. */
function parseBlocks(content: string): CmsBlock[] {
  return content.split(/\n\s*\n/).map((raw): CmsBlock => {
    const block = raw.trim()
    const lines = block.split('\n').map((l) => l.trim())
    if (lines.length === 1 && HEADING.test(block)) return { kind: 'heading', text: block }
    if (lines.every((l) => BULLET.test(l))) return { kind: 'list', items: lines.map((l) => l.replace(BULLET, '')) }
    return { kind: 'text', text: block }
  })
}

/** Loads a page from the admin panel's CMS (plain text). A null slug is a page that does not exist. */
export function useCmsPage(slug: string | null): CmsState {
  const [state, setState] = useState<CmsState>({ status: 'loading' })

  useEffect(() => {
    if (slug === null) {
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
          title: page.title ?? '',
          blocks: parseBlocks(content),
          updated: page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
        })
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setState({ status: 'message', text: 'Could not load this page. Please check your connection and try again.' })
      })
    return () => controller.abort()
  }, [slug])

  return state
}
