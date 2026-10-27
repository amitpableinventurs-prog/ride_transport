import { Link } from 'react-router-dom'
import { ArrowRight, Bike, Eye, HeartHandshake, IndianRupee, MapPin, Package, ShieldCheck, Target, Truck, type LucideIcon } from 'lucide-react'
import { site } from '@/config'
import { CmsBlocks } from '@/components/CmsBlocks'
import { PageHero } from '@/components/PageHero'
import { useCmsPage } from '@/hooks/useCmsPage'
import { usePageTitle } from '@/hooks/usePageTitle'

const SERVICES: { icon: LucideIcon; title: string; text: string; to: string }[] = [
  { icon: Bike, title: 'Rides', text: 'Bikes, autos and cabs, plus rental cars by the hour, with the fare shown before you book.', to: '/#services' },
  { icon: Package, title: 'Parcel delivery', text: 'Bike porters for parcels and small packages, with an OTP and a photo at every drop.', to: '/#delivery' },
  { icon: Truck, title: 'Goods & logistics', text: '6–14 ft goods vehicles for stock, shifting and multi-drop deliveries across the city.', to: '/#delivery' },
]

const VALUES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: 'Safety first', text: 'Verified riders, selfie checks, OTP-started trips, live trip sharing and SOS in the app.' },
  { icon: IndianRupee, title: 'Fair and upfront', text: 'Customers see the fare before booking and riders see their earning before accepting.' },
  { icon: HeartHandshake, title: 'Good for riders', text: 'Flexible hours, nearby trips first and payouts to bank or UPI for the people who drive with us.' },
]

/** Shown while the About page in the admin panel's CMS has no content. */
function DefaultStory() {
  return (
    <>
      <p>
        {site.name} started with a simple idea: getting around the city, or getting something across it, should take a few taps and a fair price. We bring bikes, autos,
        cabs and goods vehicles into one app, so the right vehicle is always close by.
      </p>
      <p>
        Every rider on {site.name} is verified before their first trip, every trip starts with the customer's OTP, and both sides rate each other at the end. That is
        how we keep the service safe and dependable as we grow.
      </p>
    </>
  )
}

export function AboutPage() {
  usePageTitle('About us')
  const cms = useCmsPage('about')

  return (
    <>
      <PageHero
        eyebrow="About us"
        title={
          <>
            Connecting people. <span className="text-brand-400">Moving possibilities.</span>
          </>
        }
      >
        {site.name} is a ride and delivery platform from {site.legalName}: bikes, autos, cabs and goods vehicles in one app.
      </PageHero>

      <section className="py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow">Our story</p>
            <h2 className="section-title mt-2">Who we are</h2>
            <div className="prose-policy mt-4" aria-busy={cms.status === 'loading'}>
              {cms.status === 'ready' ? <CmsBlocks blocks={cms.blocks} /> : <DefaultStory />}
            </div>
          </div>
          <div className="rounded-3xl border border-ink-100 bg-white p-8 shadow-sm">
            <img src={`${import.meta.env.BASE_URL}brand/anz-logo.png`} alt={`${site.legalName} logo`} width={800} height={490} className="h-auto w-full" />
          </div>
        </div>
      </section>

      <section className="bg-ink-50 py-20">
        <div className="container-x grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl bg-ink-950 p-8 text-white">
            <span className="icon-chip bg-brand-500 text-white">
              <Target className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold">Our mission</h2>
            <p className="mt-2 leading-7 text-white/70">To make every ride and delivery in the city quick to book, fairly priced and safe, for customers and riders alike.</p>
          </article>
          <article className="rounded-3xl bg-white p-8 shadow-sm">
            <span className="icon-chip">
              <Eye className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">Our vision</h2>
            <p className="mt-2 leading-7 text-ink-500">One app people trust for moving themselves and their goods, in every city we serve.</p>
          </article>
        </div>
      </section>

      <section className="py-20">
        <div className="container-x">
          <p className="eyebrow">What we do</p>
          <h2 className="section-title mt-2">One app, three ways to move</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SERVICES.map(({ icon: Icon, title, text, to }) => (
              <Link key={title} to={to} className="card group block">
                <span className="icon-chip">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-500">{text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                  Learn more <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-50 py-20">
        <div className="container-x">
          <p className="eyebrow">What we stand for</p>
          <h2 className="section-title mt-2">Our values</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl bg-white p-6 shadow-sm">
                <span className="icon-chip">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Where we operate</p>
            <h2 className="section-title mt-2">Cities we serve</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {site.cities.map((city) => (
                <li key={city} className="rounded-full border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700">
                  {city}
                </li>
              ))}
            </ul>
          </div>
          {site.contact.address && (
            <div className="rounded-3xl border border-ink-100 p-8">
              <h2 className="font-display text-xl font-semibold text-ink-900">Registered office</h2>
              <p className="mt-1 text-sm font-medium text-ink-700">{site.legalName}</p>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-ink-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                {site.contact.address}
              </p>
              <Link to="/contact" className="btn-dark mt-6">
                Contact us <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
