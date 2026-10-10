import type { Request, Response } from 'express'
import { CmsPage } from '../models/CmsPage'
import { recordAudit } from '../utils/audit'

export const CMS_SLUGS = ['about', 'contact', 'terms', 'privacy', 'cancellation', 'refund', 'rider_terms', 'rider_privacy', 'partner_terms', 'faq'] as const
export type CmsSlug = (typeof CMS_SLUGS)[number]

const CMS_TITLES: Record<CmsSlug, string> = {
  about: 'About Us',
  contact: 'Contact Us',
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  cancellation: 'Cancellation Policy',
  refund: 'Refund Policy',
  rider_terms: 'Rider Terms & Conditions',
  rider_privacy: 'Privacy Policy',
  partner_terms: 'Partner Terms',
  faq: 'FAQ',
}

function isCmsSlug(value: string): value is CmsSlug {
  return (CMS_SLUGS as readonly string[]).includes(value)
}

async function getOrCreatePage(slug: CmsSlug) {
  const existing = await CmsPage.findOne({ slug })
  if (existing) return existing
  return CmsPage.create({ slug, title: CMS_TITLES[slug], content: '' })
}

export async function listCmsPages(_req: Request, res: Response) {
  const pages = await Promise.all(CMS_SLUGS.map((slug) => getOrCreatePage(slug)))
  res.json(pages)
}

export async function getCmsPage(req: Request, res: Response) {
  const { slug } = req.params
  if (!isCmsSlug(slug)) {
    res.status(404).json({ message: 'Unknown CMS page' })
    return
  }
  const page = await getOrCreatePage(slug)
  res.json(page)
}

export async function updateCmsPage(req: Request, res: Response) {
  const { slug } = req.params
  if (!isCmsSlug(slug)) {
    res.status(404).json({ message: 'Unknown CMS page' })
    return
  }

  const body = req.body as { title?: string; content?: string }
  const page = await getOrCreatePage(slug)
  if (body.title !== undefined) page.title = body.title
  if (body.content !== undefined) page.content = body.content
  page.updatedBy = req.admin!.id
  await page.save()

  await recordAudit(req.admin!, 'cms.updated', 'CmsPage', page.title)
  res.json(page)
}
