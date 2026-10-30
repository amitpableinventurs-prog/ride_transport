"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Restores the CMS pages to exactly the seeded state (seedExtended.ts) — the
// placeholder demo content shown in the customer, rider and partner apps.
//
//   npm run restore:cms
//
// Useful if a page was created empty by the API's get-or-create path (e.g. the
// Rider Privacy Policy) or a title drifted from the seeded value. Sets every
// page's title and placeholder content and marks it as updated by the super admin.
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const mongoose_1 = __importDefault(require("mongoose"));
const Admin_1 = require("./models/Admin");
const CmsPage_1 = require("./models/CmsPage");
// Kept in sync with seedExtended.ts so the data matches the original seed exactly.
const cmsDefs = [
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
];
async function restore() {
    if (env_1.env.isProduction) {
        throw new Error('Refusing to run the CMS restore with NODE_ENV=production.');
    }
    await (0, db_1.connectDb)();
    console.log(`[restore:cms] connected to ${env_1.env.mongoUri}`);
    const superAdmin = await Admin_1.Admin.findOne({ email: 'super@rideflow.demo' });
    for (const p of cmsDefs) {
        await CmsPage_1.CmsPage.findOneAndUpdate({ slug: p.slug }, {
            slug: p.slug,
            title: p.title,
            content: `This is placeholder content for the ${p.title} page. Edit me from the CMS section.`,
            updatedBy: superAdmin?._id,
        }, { upsert: true, new: true });
    }
    console.log(`[restore:cms] done. Restored ${cmsDefs.length} CMS pages to the seeded state.`);
    await mongoose_1.default.disconnect();
}
restore().catch((err) => {
    console.error('[restore:cms] failed', err);
    process.exit(1);
});
//# sourceMappingURL=restoreCms.js.map