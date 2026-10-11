// Restores the CMS pages to exactly the seeded state (seedExtended.ts) — the
// placeholder demo content shown in the customer, rider and partner apps.
//
//   npm run restore:cms
//
// Useful if a page was created empty by the API's get-or-create path (e.g. the
// Rider Privacy Policy) or a title drifted from the seeded value. Sets every
// page's title and placeholder content and marks it as updated by the super admin.
import { connectDb } from './config/db'
import { env } from './config/env'
import mongoose from 'mongoose'
import { Admin } from './models/Admin'
import { CmsPage } from './models/CmsPage'

// Kept in sync with seedExtended.ts so the data matches the original seed exactly.
const cmsDefs: { slug: string; title: string }[] = [
  { slug: 'about', title: 'About Us' },
  { slug: 'contact', title: 'Contact Us' },
  { slug: 'terms', title: 'Terms & Conditions' },
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'cancellation', title: 'Cancellation Policy' },
  { slug: 'refund', title: 'Refund Policy' },
  { slug: 'rider_terms', title: 'Rider Terms & Conditions' },
  { slug: 'rider_privacy', title: 'Privacy Policy' },
  { slug: 'partner_terms', title: 'Partner Terms' },
  { slug: 'faq', title: 'FAQs' },
]

async function restore() {
  if (env.isProduction) {
    throw new Error('Refusing to run the CMS restore with NODE_ENV=production.')
  }

  await connectDb()
  console.log(`[restore:cms] connected to ${env.mongoUri}`)

  const superAdmin = await Admin.findOne({ email: 'super@rideflow.demo' })

  for (const p of cmsDefs) {
    await CmsPage.findOneAndUpdate(
      { slug: p.slug },
      {
        slug: p.slug,
        title: p.title,
        content: `This is placeholder content for the ${p.title} page. Edit me from the CMS section.`,
        updatedBy: superAdmin?._id,
      },
      { upsert: true, new: true },
    )
  }

  console.log(`[restore:cms] done. Restored ${cmsDefs.length} CMS pages to the seeded state.`)
  await mongoose.disconnect()
}

restore().catch((err) => {
  console.error('[restore:cms] failed', err)
  process.exit(1)
})
