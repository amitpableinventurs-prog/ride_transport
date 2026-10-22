import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Navigation, Smartphone, UserRound, type LucideIcon } from 'lucide-react'
import { site } from '@/config'
import { CmsBlocks } from '@/components/CmsBlocks'
import { PageHero } from '@/components/PageHero'
import { useCmsPage } from '@/hooks/useCmsPage'
import { usePageTitle } from '@/hooks/usePageTitle'
import { contactChannels } from '@/lib/contact'

const TOPICS: { icon: LucideIcon; title: string; text: string; link: { label: string; to: string } }[] = [
  {
    icon: Smartphone,
    title: 'Customers',
    text: 'For a trip, payment or refund, raise a ticket from Help in the app; it carries your booking details so we can sort it out faster.',
    link: { label: 'Read the FAQ', to: '/#faq' },
  },
  {
    icon: UserRound,
    title: 'Riders',
    text: 'Want to drive with us, or have a question about documents, dues or payouts? Start here, or use Help in the rider app.',
    link: { label: 'Drive with us', to: '/drive' },
  },
  {
    icon: Building2,
    title: 'Transport partners',
    text: 'Run a fleet of goods vehicles? Call us to put your vehicles and drivers to work on AnZ delivery requests.',
    link: { label: 'Partner terms', to: '/policy/partner_terms' },
  },
]

export function ContactPage() {
  usePageTitle('Contact us')
  const cms = useCmsPage('contact')
  const channels = contactChannels()
  const { address } = site.contact
  const mapQuery = encodeURIComponent(address)

  return (
    <>
      <PageHero eyebrow="Contact us" title="We're here to help">
        Questions about a ride, a delivery or driving with {site.name}? Reach us any of these ways.
      </PageHero>

      {channels.length > 0 && (
        <section className="relative z-10 -mt-8">
          <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {channels.map(({ icon: Icon, label, text, href }) => {
              const body = (
                <>
                  <span className="icon-chip shrink-0">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</span>
                    <span className="mt-1 block font-medium leading-6 text-ink-900">{text}</span>
                  </span>
                </>
              )
              return href ? (
                <a key={label} href={href} className="card flex items-start gap-4">
                  {body}
                </a>
              ) : (
                <div key={label} className="flex items-start gap-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                  {body}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {cms.status === 'ready' && (
        <section className="pt-16">
          <div className="container-x prose-policy max-w-3xl">
            <CmsBlocks blocks={cms.blocks} />
          </div>
        </section>
      )}

      <section className="py-20">
        <div className="container-x">
          <p className="eyebrow">How can we help?</p>
          <h2 className="section-title mt-2">Find the right place</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TOPICS.map(({ icon: Icon, title, text, link }) => (
              <article key={title} className="flex flex-col rounded-2xl border border-ink-100 p-6">
                <span className="icon-chip">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-6 text-ink-500">{text}</p>
                <Link to={link.to} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                  {link.label} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {address && (
        <section className="bg-ink-50 py-20">
          <div className="container-x grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">Visit us</p>
              <h2 className="section-title mt-2">Our office</h2>
              <p className="mt-4 font-medium text-ink-900">{site.legalName}</p>
              <p className="mt-2 leading-7 text-ink-500">{address}</p>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`} target="_blank" rel="noreferrer" className="btn-dark mt-6">
                <Navigation className="h-4 w-4" aria-hidden />
                Get directions
              </a>
            </div>
            <iframe
              title={`Map showing ${site.name} office`}
              src={`https://maps.google.com/maps?q=${mapQuery}&z=15&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-80 w-full rounded-3xl border-0 bg-ink-100 shadow-sm lg:h-96"
            />
          </div>
        </section>
      )}
    </>
  )
}
