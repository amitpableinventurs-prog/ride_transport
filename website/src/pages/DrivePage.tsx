import { Link } from 'react-router-dom'
import { ArrowRight, Bike, Building2, Car, CarTaxiFront, CircleCheck, Clock, Headset, IndianRupee, MapPin, Navigation, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { StoreButtons } from '@/components/StoreButtons'
import { usePageTitle } from '@/hooks/usePageTitle'

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Clock, title: 'Flexible hours', text: 'Switch on duty when you want to work and off when you are done. No fixed shifts.' },
  { icon: IndianRupee, title: 'Earning shown upfront', text: 'Every request shows the pickup, drop and what you will earn before you accept.' },
  { icon: MapPin, title: 'Nearby trips first', text: 'Requests go to the closest riders first, so you spend less time driving to pickups.' },
  { icon: Navigation, title: 'Demand heatmap', text: 'See where requests are coming from right now and head where the trips are.' },
  { icon: Wallet, title: 'Withdraw to bank or UPI', text: 'Earnings from online payments go to your AnZ wallet. Request a payout to your bank account or UPI ID.' },
  { icon: Headset, title: 'Help in the app', text: 'Raise a ticket from the app for payments, trips or account questions, and use SOS in an emergency.' },
]

const VEHICLES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Bike, title: 'Bike', text: 'Rides and parcel delivery' },
  { icon: CarTaxiFront, title: 'Auto', text: 'City rides' },
  { icon: Car, title: 'Cab', text: 'Economy, premium and rentals' },
  { icon: Truck, title: 'Goods vehicle', text: '6–14 ft, goods and shifting' },
]

const STEPS = [
  { title: 'Download the rider app', text: 'Sign up with your mobile number and OTP.' },
  { title: 'Add your documents and vehicle', text: 'Upload photos of the documents below and your vehicle details.' },
  { title: 'Get verified', text: 'Our team reviews your profile. You are notified in the app once you are approved.' },
  { title: 'Take a selfie and go online', text: 'A quick selfie check, switch on duty, and start accepting trips.' },
]

const DOCUMENTS = [
  { name: 'Driving licence', note: 'front and back' },
  { name: 'Aadhaar or PAN card', note: 'for identity' },
  { name: 'Vehicle papers', note: 'RC, insurance, pollution certificate and permit, as applicable' },
  { name: 'A clear profile photo' },
]

export function DrivePage() {
  usePageTitle('Drive with us – earn with your bike, auto, cab or goods vehicle')

  return (
    <>
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-brand-400/10 blur-3xl" />
        <div className="container-x relative py-16 lg:py-24">
          <p className="eyebrow text-brand-400">Drive with AnZ Cabs</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Your vehicle. Your hours. <span className="text-brand-400">Your earnings.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Take ride and delivery requests near you with a bike, auto, cab or goods vehicle. Go online when it suits you and get paid for every trip.
          </p>
          <StoreButtons app="rider" className="mt-8" />
        </div>
      </section>

      <section className="py-20">
        <div className="container-x">
          <p className="eyebrow">Why drive with us</p>
          <h2 className="section-title mt-2">Built around the rider</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <article key={title} className="card">
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

      <section className="bg-ink-50 py-20">
        <div className="container-x">
          <p className="eyebrow">Vehicles</p>
          <h2 className="section-title mt-2">Who can join</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VEHICLES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl bg-white p-5 shadow-sm">
                <span className="icon-chip">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-ink-900">{title}</p>
                  <p className="text-xs text-ink-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-x grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Getting started</p>
            <h2 className="section-title mt-2">Start in four steps</h2>
            <ol className="mt-8 space-y-5">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-950 font-display text-sm font-semibold text-brand-400">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold text-ink-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-ink-500">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl border border-ink-100 p-8">
            <h3 className="font-display text-xl font-semibold text-ink-900">Documents you need</h3>
            <ul className="mt-6 space-y-3 text-sm">
              {DOCUMENTS.map((doc) => (
                <li key={doc.name} className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden />
                  <span>
                    <strong className="text-ink-900">{doc.name}</strong>
                    {doc.note && <span className="text-ink-500"> – {doc.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl bg-ink-50 p-4 text-xs leading-5 text-ink-500">
              On cash trips you collect the fare from the customer and the AnZ Cabs commission is added to your dues, which you pay from the app. Keep dues within the limit
              to stay online. Read the{' '}
              <Link to="/policy/rider_terms" className="font-medium text-brand-600 underline">
                Rider Terms
              </Link>{' '}
              for details.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-3xl bg-ink-950 p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="icon-chip bg-brand-500 text-white">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Run a fleet of goods vehicles?</h2>
            <p className="mt-3 max-w-xl text-white/60">Partner with AnZ Cabs as a transport partner and put your vehicles and drivers to work on delivery requests.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/policy/contact" className="btn-brand">
              Contact us <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link to="/policy/partner_terms" className="btn-ghost">
              Partner terms
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
