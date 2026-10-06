import { useEffect, useState, type FormEvent } from 'react'
import { Save, Check } from 'lucide-react'
import { fetchCmsPages, updateCmsPage } from '@/api/cms'
import type { CmsPage, CmsSlug } from '@/types/marketing'
import { LoadingScreen } from '@/components/common/LoadingScreen'
import { PermissionGate } from '@/components/common/PermissionGate'
import { useAuthStore } from '@/store/authStore'

const CMS_LABELS: Record<CmsSlug, string> = {
  about: 'About Us',
  contact: 'Contact Us',
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  cancellation: 'Cancellation Policy',
  refund: 'Refund Policy',
  rider_terms: 'Rider Terms',
  partner_terms: 'Partner Terms',
  faq: 'FAQ',
}

export function CmsPagesPage() {
  const canManage = useAuthStore((s) => s.hasPermission('marketing.manage'))
  const [pages, setPages] = useState<CmsPage[] | null>(null)
  const [activeSlug, setActiveSlug] = useState<CmsSlug | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCmsPages()
      .then((data) => {
        setPages(data)
        if (data[0]) {
          setActiveSlug(data[0].slug)
          setTitle(data[0].title)
          setContent(data[0].content)
        }
      })
      .catch(() => setError('Could not load CMS pages.'))
  }, [])

  function selectPage(page: CmsPage) {
    setActiveSlug(page.slug)
    setTitle(page.title)
    setContent(page.content)
    setSaved(false)
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!activeSlug) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateCmsPage(activeSlug, { title, content })
      setPages((prev) => (prev ? prev.map((p) => (p.slug === activeSlug ? updated : p)) : prev))
      setSaved(true)
    } catch {
      setError('Could not save this page.')
    } finally {
      setSaving(false)
    }
  }

  if (!pages) return <LoadingScreen />

  const activePage = pages.find((p) => p.slug === activeSlug)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">CMS Pages</h1>
        <p className="text-sm text-navy-400">Static content shown in the customer, rider and partner apps.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
          {pages.map((page) => (
            <button
              key={page.slug}
              onClick={() => selectPage(page)}
              className={`block w-full border-b border-navy-50 px-4 py-3 text-left text-sm last:border-0 ${
                page.slug === activeSlug ? 'bg-navy-50 font-semibold text-navy-800' : 'text-navy-600 hover:bg-navy-50/60'
              }`}
            >
              {CMS_LABELS[page.slug] ?? page.slug}
            </button>
          ))}
        </div>

        <fieldset disabled={!canManage} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
          {activePage ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-600">Page title</label>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setSaved(false)
                  }}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-navy-600">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    setSaved(false)
                  }}
                  rows={16}
                  className="input font-mono text-xs"
                />
                <span className="mt-1 block text-xs text-navy-300">Plain text or HTML is supported.</span>
              </div>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

              <PermissionGate permission="marketing.manage">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-dark disabled:opacity-60"
                >
                  {saved ? <Check size={16} /> : <Save size={16} />}
                  {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
                </button>
              </PermissionGate>
            </form>
          ) : (
            <p className="text-sm text-navy-400">Select a page to edit.</p>
          )}
        </fieldset>
      </div>
    </div>
  )
}
