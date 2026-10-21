import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bike,
  CalendarClock,
  Camera,
  Car,
  CarFront,
  CarTaxiFront,
  ChevronDown,
  FileCheck2,
  IndianRupee,
  KeyRound,
  MapPin,
  Navigation,
  Package,
  Route,
  Share2,
  ShieldCheck,
  Siren,
  Smartphone,
  Star,
  Truck,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { site } from '@/config'
import { Slider } from '@/components/Slider'
import { StoreButtons } from '@/components/StoreButtons'
import { usePageTitle } from '@/hooks/usePageTitle'

interface Feature {
  icon: LucideIcon
  title: string
  text: string
}

const RIDES: Feature[] = [
  { icon: Bike, title: 'Bike', text: 'The fastest way through traffic for solo trips.' },
  { icon: Bike, title: 'Bike Lite', text: 'Our lowest-cost option for everyday solo rides.' },
  { icon: CarTaxiFront, title: 'Auto', text: 'Budget-friendly 3-seater for short city trips.' },
  { icon: Car, title: 'Cab Economy', text: 'Affordable AC cabs for daily commutes.' },
  { icon: CarFront, title: 'Cab Premium', text: 'Roomier cars and extra comfort when it matters.' },
  { icon: CalendarClock, title: 'Rental Cars', text: 'Book a car with a driver by the hour for errands and meetings.' },
]

const DELIVERY_VEHICLES: Feature[] = [
  { icon: Package, title: 'Bike Porter', text: 'Parcels and small packages, delivered fastest.' },
  { icon: Truck, title: 'Small Vehicles', text: '6–14 ft vehicles for goods, stock and shifting.' },
]

const DELIVERY_FEATURES: Feature[] = [
  { icon: Route, title: 'Up to 5 drops in one trip', text: 'Deliver to several addresses with one booking.' },
  { icon: Camera, title: 'Photo at pickup and delivery', text: 'The rider photographs the goods at pickup and takes a proof-of-delivery photo at every drop.' },
  { icon: KeyRound, title: 'OTP at every drop', text: "Each drop is completed only with the receiver's OTP, so goods reach the right hands." },
  { icon: Users, title: 'Loading help on request', text: 'Ask for help with loading and unloading when you book.' },
]

const STEPS = [
  { title: 'Set pickup and drop', text: 'Search a place or drop the pin. Saved places like Home and Work are one tap away.' },
  { title: 'Pick a ride, see the fare', text: 'Compare bikes, autos and cabs with their fares, then book. A nearby verified rider accepts.' },
  { title: 'Share the OTP and go', text: 'The trip starts with your OTP. Pay at the end by cash, UPI, card or AnZ wallet.' },
]

const SAFETY: Feature[] = [
  { icon: FileCheck2, title: 'Verified riders', text: 'Licence, vehicle papers and identity are reviewed before a rider is approved.' },
  { icon: BadgeCheck, title: 'Selfie checks', text: 'Riders take a fresh selfie to go online, so the person on the trip is the person we verified.' },
  { icon: KeyRound, title: 'OTP to start', text: 'The ride starts only after you share your OTP with the right rider.' },
  { icon: Share2, title: 'Share your trip', text: 'Send family a live link to follow your ride until you arrive.' },
  { icon: Siren, title: 'SOS in the app', text: 'One tap alerts our team with your trip and location.' },
  { icon: Star, title: 'Ratings both ways', text: 'Customers and riders rate each other after every trip, keeping quality high.' },
]

const PAYMENTS: { icon: LucideIcon; label: string }[] = [
  { icon: Banknote, label: 'Cash to the rider' },
  { icon: Smartphone, label: 'UPI' },
  { icon: IndianRupee, label: 'Cards & netbanking' },
  { icon: Wallet, label: 'AnZ wallet' },
]

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'How is my fare calculated?',
    a: 'The app shows the fare for each ride type before you book, based on the road distance and travel time of your route. It can change if you change the drop during the trip or the rider waits beyond the free waiting time at pickup.',
  },
  {
    q: 'Can I cancel a booking?',
    a: (
      <>
        Yes, and it is always free. You can cancel from the app any time before the trip starts. See our{' '}
        <Link to="/policy/cancellation" className="font-medium text-brand-600 underline">
          Cancellation Policy
        </Link>
        .
      </>
    ),
  },
  { q: 'How can I pay?', a: 'Pay the rider in cash, or pay in the app by UPI, card, netbanking or your AnZ wallet.' },
  {
    q: 'How do I share my trip with family?',
    a: 'During a trip, tap Share in the app to send a live tracking link. Anyone with the link can follow the ride until it ends.',
  },
  {
    q: 'How do I know my parcel was delivered?',
    a: "Each drop is completed with the receiver's OTP and a delivery photo, and you can follow the vehicle live until the last drop.",
  },
  {
    q: 'How do I become an AnZ Cabs rider?',
    a: (
      <>
        Download the rider app, upload your documents and vehicle details, and start taking trips once you are verified.{' '}
        <Link to="/drive" className="font-medium text-brand-600 underline">
          Learn more
        </Link>
        .
      </>
    ),
  },
]

interface Highlight {
  icon: LucideIcon
  eyebrow: string
  title: string
  text: string
  cta: { label: string; to: string }
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: Bike,
    eyebrow: 'Bike rides',
    title: 'Beat the traffic on a bike',
    text: 'The fastest way through the city for solo trips. See the fare before you book and pay by cash or UPI.',
    cta: { label: 'Get the app', to: '/#download' },
  },
  {
    icon: Package,
    eyebrow: 'Parcel delivery',
    title: 'Send parcels across town',
    text: 'Bike porters and small goods vehicles, up to 5 drops in one trip, with an OTP and a photo at every drop.',
    cta: { label: 'See delivery', to: '/#delivery' },
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Safety',
    title: 'Safe rides, every time',
    text: 'Verified riders, an OTP to start every trip, live trip sharing with family and SOS in the app.',
    cta: { label: 'How we keep you safe', to: '/#safety' },
  },
  {
    icon: CarFront,
    eyebrow: 'Drive with us',
    title: 'Earn with your own vehicle',
    text: 'Go online when you want, see the earning before you accept and withdraw to your bank or UPI.',
    cta: { label: 'Drive with us', to: '/drive' },
  },
]

function HighlightSlide({ icon: Icon, eyebrow, title, text, cta }: Highlight) {
  return (
    <div className="relative grid min-h-[300px] items-center gap-8 overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-600 px-6 py-10 text-white sm:px-14 md:grid-cols-[1.3fr_1fr]">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-400/25 blur-3xl" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">{eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-3 max-w-lg text-white/75">{text}</p>
        <Link to={cta.to} className="btn-brand mt-6">
          {cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="relative hidden justify-center md:flex" aria-hidden>
        <div className="flex h-44 w-44 items-center justify-center rounded-full border border-brand-300/30 bg-brand-400/15 shadow-[0_0_80px_-10px] shadow-brand-400/60">
          <Icon className="h-20 w-20 text-brand-300" strokeWidth={1.5} />
        </div>
        <div className="road absolute -bottom-6 left-0 right-0 h-1 opacity-60" />
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, text }: Feature) {
  return (
    <article className="card">
      <span className="icon-chip">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-ink-500">{text}</p>
    </article>
  )
}

/** The booking screen drawn in HTML: an illustration, not live data. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]" aria-hidden>
      <div className="rounded-[2.5rem] border border-white/15 bg-ink-800 p-3 shadow-2xl shadow-black/60">
        <div className="overflow-hidden rounded-[2rem] bg-ink-50">
          <div className="relative h-56 bg-[linear-gradient(135deg,#eef0f3_25%,#e4e7ec_25%,#e4e7ec_50%,#eef0f3_50%,#eef0f3_75%,#e4e7ec_75%)] bg-[length:40px_40px]">
            <div className="road absolute left-6 right-6 top-28 h-1 rotate-[-12deg] rounded" />
            <span className="absolute left-8 top-[7.5rem] flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-brand-400 shadow-lg">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="absolute right-10 top-16 flex h-8 w-8 items-center justify-center rounded-full bg-brand-400 text-ink-950 shadow-lg">
              <Navigation className="h-4 w-4" />
            </span>
            <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink-800 shadow">Rider 4 min away</span>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span className="h-2 w-2 rounded-full bg-green-600" />
                Patel Nagar, Indore
              </div>
              <div className="ml-[3px] h-3 border-l border-dashed border-ink-200" />
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span className="h-2 w-2 rounded-sm bg-ink-900" />
                Vijay Nagar, Indore
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border-2 border-brand-400 bg-brand-50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-900">
                  <Car className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Cab Economy</p>
                  <p className="text-[11px] text-ink-500">AC · 4 seats · 16 min</p>
                </div>
              </div>
              <p className="font-display text-base font-semibold text-ink-900">₹110</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-50 text-ink-900">
                  <Bike className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Bike</p>
                  <p className="text-[11px] text-ink-500">Solo · fastest</p>
                </div>
              </div>
              <p className="font-display text-base font-semibold text-ink-900">₹48</p>
            </div>
            <div className="rounded-full bg-ink-950 py-3 text-center text-sm font-semibold text-brand-400">Book Cab Economy</div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-white/40">Fares shown are an example.</p>
    </div>
  )
}

export function HomePage() {
  usePageTitle()

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-400/10 blur-3xl" />
        <div className="container-x relative grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-300">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Bike · Auto · Cab · Delivery
            </p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Your ride,
              <br />
              <span className="text-gradient-brand">our priority.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
              Book a bike, auto or cab in a few taps, or send a parcel across town. See the fare before you book, ride with verified riders and track every trip live.
            </p>
            <StoreButtons app="customer" className="mt-8" />
            <Link to="/drive" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-400">
              Want to earn with your vehicle? Drive with us <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <ul className="mt-10 grid gap-3 text-sm text-white/80 sm:grid-cols-3">
              <li className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-brand-400" aria-hidden />
                Upfront fares
              </li>
              <li className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-brand-400" aria-hidden />
                OTP-secured start
              </li>
              <li className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-brand-400" aria-hidden />
                Live trip tracking
              </li>
            </ul>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* Highlights slider */}
      <section className="pt-12 sm:pt-16">
        <div className="container-x">
          <Slider label="AnZ Cabs highlights" slides={HIGHLIGHTS.map((h) => <HighlightSlide key={h.title} {...h} />)} />
        </div>
      </section>

      {/* Ride services */}
      <section id="services" className="py-20">
        <div className="container-x">
          <p className="eyebrow">Ride</p>
          <h2 className="section-title mt-2">A ride for every trip</h2>
          <p className="mt-3 max-w-2xl text-ink-500">
            From a quick solo hop to a comfortable cab for the family, pick what fits the trip and the budget. The fare is shown before you book.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RIDES.map((ride) => (
              <FeatureCard key={ride.title} {...ride} />
            ))}
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section id="delivery" className="bg-ink-50 py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Delivery</p>
            <h2 className="section-title mt-2">Send parcels and goods across the city</h2>
            <p className="mt-3 text-ink-500">
              Documents, a forgotten charger or a load for the shop: book a Bike Porter or a small goods vehicle and track it to the door.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {DELIVERY_VEHICLES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                  <span className="icon-chip">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 font-display font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1 text-sm text-ink-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
          <ul className="space-y-4">
            {DELIVERY_FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm">
                <span className="icon-chip shrink-0">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1 text-sm text-ink-500">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container-x">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title mt-2">On your way in three steps</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="card">
                <span className="font-display text-4xl font-semibold text-brand-400">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-500">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="bg-ink-950 py-20 text-white">
        <div className="container-x">
          <p className="eyebrow text-brand-400">Safety</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Safety built into every trip</h2>
          <p className="mt-3 max-w-2xl text-white/60">Every rider is checked before they can take trips, and every trip has safeguards from pickup to drop.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFETY.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <Icon className="h-6 w-6 text-brand-400" aria-hidden />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-white/60">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Payments + cities */}
      <section className="py-20">
        <div className="container-x grid gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Payments</p>
            <h2 className="section-title mt-2">Pay the way you like</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {PAYMENTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 rounded-2xl border border-ink-100 p-4">
                  <span className="icon-chip">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-medium">{label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Cities</p>
            <h2 className="section-title mt-2">Where we operate</h2>
            <p className="mt-3 text-ink-500">We are growing city by city. Open the app to check service at your location.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {site.cities.map((city) => (
                <span key={city} className="inline-flex items-center gap-2 rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-medium text-ink-800 shadow-sm">
                  <MapPin className="h-4 w-4 text-brand-600" aria-hidden />
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Drive with us */}
      <section className="px-4 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-8 text-white sm:p-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Own a bike, auto, cab or goods vehicle?</h2>
            <p className="mt-3 max-w-xl text-white/85">
              Drive with AnZ Cabs on your own schedule. Go online when you want, see the earning before you accept, and withdraw to your bank or UPI.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link to="/drive" className="btn-dark">
              Drive with us <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="container-x max-w-3xl">
          <p className="eyebrow text-center">FAQ</p>
          <h2 className="section-title mt-2 text-center">Questions, answered</h2>
          <div className="mt-10 divide-y divide-ink-100 rounded-2xl border border-ink-100">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink-900">
                  {q}
                  <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 text-sm leading-6 text-ink-500">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="bg-ink-950 py-20 text-white">
        <div className="container-x flex flex-col items-center text-center">
          <img src="/brand/anz-logo.png" alt="AnZ Cabs & Logistics – Connecting People. Moving Possibilities." width={800} height={490} loading="lazy" className="h-auto w-64 rounded-3xl bg-white p-5" />
          <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Get the AnZ Cabs app</h2>
          <p className="mt-3 max-w-xl text-white/60">Book rides and deliveries, track them live and pay your way.</p>
          <StoreButtons app="customer" className="mt-8 justify-center" />
        </div>
      </section>
    </>
  )
}
