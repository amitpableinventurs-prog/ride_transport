// Publishes the policy texts in src/content/policies.ts to the CMS (title + content), so the apps,
// the /terms-style web pages and the website show them. Other CMS pages are left as they are.
//
//   npm run publish:policies                    (every page)
//   npm run publish:policies -- about contact   (only these slugs)
import mongoose from 'mongoose'
import { connectDb } from './config/db'
import { env } from './config/env'
import { POLICIES } from './content/policies'
import { CmsPage } from './models/CmsPage'

async function publish() {
  await connectDb()
  console.log(`[publish:policies] connected to ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`)
  const only = process.argv.slice(2)
  const unknown = only.filter((slug) => !POLICIES.some((p) => p.slug === slug))
  if (unknown.length) throw new Error(`Unknown page: ${unknown.join(', ')}. Pages: ${POLICIES.map((p) => p.slug).join(', ')}`)
  for (const policy of only.length ? POLICIES.filter((p) => only.includes(p.slug)) : POLICIES) {
    await CmsPage.findOneAndUpdate({ slug: policy.slug }, { $set: { title: policy.title, content: policy.content } }, { upsert: true })
    console.log(`[publish:policies] ${policy.slug}: ${policy.title} (${policy.content.length} characters)`)
  }
  await mongoose.disconnect()
}

publish().catch((err) => {
  console.error('[publish:policies] failed', err)
  process.exit(1)
})
