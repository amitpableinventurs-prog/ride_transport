# AnZ Cabs website

Public marketing site for AnZ Cabs, separate from the admin panel (`../src`) and the API (`../server`).
React 19 + React Router + Tailwind CSS, built with Vite.

## Routes

| Route | Page | What it is |
|---|---|---|
| `/` | `src/pages/HomePage.tsx` | Rides, delivery, how it works, safety, payments, cities, FAQ, app download |
| `/drive` | `src/pages/DrivePage.tsx` | Rider recruitment and transport partners |
| `/about` | `src/pages/AboutPage.tsx` | Story, mission, services, values, cities, office; the story is the CMS `about` page once it has content |
| `/gallery` | `src/pages/GalleryPage.tsx` | Photo gallery (from `site.gallery` in `src/config.ts`, files in `public/gallery/`) and brand logos to download |
| `/contact` | `src/pages/ContactPage.tsx` | Phone, WhatsApp, email and office from `site.contact`, help topics, map; shows the CMS `contact` page text once it has content |
| `/policy/:slug` | `src/pages/PolicyPage.tsx` | A page from the admin panel's CMS: `terms`, `privacy`, `cancellation`, `refund`, `rider_terms`, `rider_privacy`, `partner_terms`, `faq` (`about` and `contact` redirect to the pages above) |

The header and footer are in `src/components/Layout.tsx`. To change the gallery, put the images in `public/gallery/` and edit the
`gallery` list in `src/config.ts`; the illustrations there now are placeholders until real photos are added.

## Setup

```bash
cd website
npm install
cp .env.example .env      # set VITE_API_BASE_URL (the API's /api/v1 address)
npm run dev               # http://localhost:5180
npm run build             # static files in dist/
```

## Before going live

1. **`src/config.ts`**: add the Play Store / App Store links (buttons show "Coming soon" until then), the support phone, email,
   WhatsApp and address (hidden while empty), and check the city list against the service areas in the admin panel.
2. **Policy pages**: write the content in the admin panel → CMS. Pages without content show "not published yet".
3. **API access**: set `VITE_API_BASE_URL` to the live API (`https://<api-host>/api/v1`) and add the website's address to the
   server's `CORS_ORIGIN` (comma-separated, e.g. `https://admin.example.com,https://www.example.com`).
4. **Hosting**: deploy `dist/` to any static host and send unknown paths to `index.html`, so `/drive` and `/policy/...` open
   directly (Nginx: `try_files $uri /index.html;`, Apache: `FallbackResource /index.html`, Netlify: `/* /index.html 200`).
