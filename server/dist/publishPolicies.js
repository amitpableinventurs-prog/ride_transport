"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Publishes the policy texts in src/content/policies.ts to the CMS (title + content), so the apps,
// the /terms-style web pages and the website show them. Other CMS pages are left as they are.
//
//   npm run publish:policies                    (every page)
//   npm run publish:policies -- about contact   (only these slugs)
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const policies_1 = require("./content/policies");
const CmsPage_1 = require("./models/CmsPage");
async function publish() {
    await (0, db_1.connectDb)();
    console.log(`[publish:policies] connected to ${env_1.env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
    const only = process.argv.slice(2);
    const unknown = only.filter((slug) => !policies_1.POLICIES.some((p) => p.slug === slug));
    if (unknown.length)
        throw new Error(`Unknown page: ${unknown.join(', ')}. Pages: ${policies_1.POLICIES.map((p) => p.slug).join(', ')}`);
    for (const policy of only.length ? policies_1.POLICIES.filter((p) => only.includes(p.slug)) : policies_1.POLICIES) {
        await CmsPage_1.CmsPage.findOneAndUpdate({ slug: policy.slug }, { $set: { title: policy.title, content: policy.content } }, { upsert: true });
        console.log(`[publish:policies] ${policy.slug}: ${policy.title} (${policy.content.length} characters)`);
    }
    await mongoose_1.default.disconnect();
}
publish().catch((err) => {
    console.error('[publish:policies] failed', err);
    process.exit(1);
});
//# sourceMappingURL=publishPolicies.js.map