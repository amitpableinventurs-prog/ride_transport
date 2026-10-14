// Publishes the policy texts in src/content/policies.ts to the CMS (title + content), so the apps,
// the /terms-style web pages and the website show them. Other CMS pages are left as they are.
//
//   npm run publish:policies
import mongoose from 'mongoose'
import { connectDb } from './config/db'
import { env } from './config/env'
import { POLICIES } from './content/policies'
import { CmsPage } from './models/CmsPage'

async function publish() {
  await connectDb()
  console.log(`[publish:policies] connected to ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`)
  for (const policy of POLICIES) {
    await CmsPage.findOneAndUpdate({ slug: policy.slug }, { $set: { title: policy.title, content: policy.content } }, { upsert: true })
    console.log(`[publish:policies] ${policy.slug}: ${policy.title} (${policy.content.length} characters)`)
  }
  await mongoose.disconnect()
}

publish().catch((err) => {
  console.error('[publish:policies] failed', err)
  process.exit(1)
})
