import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, Smartphone, X } from 'lucide-react'
import { site } from '@/config'
import { contactChannels } from '@/lib/contact'
import { StoreButtons } from './StoreButtons'

const NAV = [
  { label: 'Ride', to: '/#services' },
  { label: 'Delivery', to: '/#delivery' },
  { label: 'Safety', to: '/#safety' },
  { label: 'Drive with us', to: '/drive' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'About', to: '/about' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
]

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="AnZ Cabs home">
      <img src={`${import.meta.env.BASE_URL}brand/anz-icon.png`} alt="" width={size} height={size} className="rounded-lg bg-white" style={{ width: size, height: size }} />
      <span className="font-display text-lg font-semibold tracking-tight text-white">
        AnZ <span className="text-brand-400">Cabs</span>
      </span>
    </Link>
  )
}

/** Scrolls to `#section` links (also across pages) and to the top on a new page. */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    // Wait a frame so a page that just mounted has rendered its sections.
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return null
}

function Header() {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()
  useEffect(() => setOpen(false), [pathname, hash])

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-full focus:bg-brand-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((item) =>
            item.to.includes('#') ? (
              <Link key={item.to} to={item.to} className="nav-link">
                {item.label}
              </Link>
            ) : (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'text-brand-400' : ''}`}>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/#download" className="btn-brand hidden px-4 py-2.5 sm:inline-flex">
            <Smartphone className="h-4 w-4" aria-hidden />
            Get the app
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-full p-2 text-white hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-white/10 lg:hidden" aria-label="Mobile">
          <div className="container-x flex flex-col py-3">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="nav-link py-3">
                {item.label}
              </Link>
            ))}
            <Link to="/#download" className="btn-brand mt-2">
              Get the app
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}

function ContactList() {
  return (
    <ul className="mt-4 space-y-3 text-sm">
      <li>
        <Link to="/contact" className="hover:text-brand-400">
          Contact us
        </Link>
      </li>
      {contactChannels().map(({ icon: Icon, text, href }) => (
        <li key={text} className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
          {href ? (
            <a href={href} className="hover:text-brand-400">
              {text}
            </a>
          ) : (
            <span>{text}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function FooterLinks({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="hover:text-brand-400">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Footer() {
  return (
    <footer className="bg-ink-950 text-white/70">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size={40} />
          <p className="mt-4 max-w-xs text-sm leading-6">Bikes, autos, cabs and goods delivery in one app. {site.tagline}.</p>
          <StoreButtons app="customer" compact className="mt-5 gap-2" />
        </div>
        <FooterLinks
          title="Services"
          links={[
            { label: 'Bike & Bike Lite', to: '/#services' },
            { label: 'Auto', to: '/#services' },
            { label: 'Cabs & rentals', to: '/#services' },
            { label: 'Parcel & goods delivery', to: '/#delivery' },
            { label: 'Drive with AnZ Cabs', to: '/drive' },
          ]}
        />
        <FooterLinks
          title="Company"
          links={[
            { label: 'About us', to: '/about' },
            { label: 'Gallery', to: '/gallery' },
            { label: 'Terms & Conditions', to: '/policy/terms' },
            { label: 'Privacy Policy', to: '/policy/privacy' },
            { label: 'Cancellation Policy', to: '/policy/cancellation' },
            { label: 'Refund Policy', to: '/policy/refund' },
          ]}
        />
        <div>
          <h2 className="text-sm font-semibold text-white">Contact</h2>
          <ContactList />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            <Link to="/policy/rider_terms" className="hover:text-brand-400">
              Rider terms
            </Link>
            <span className="mx-2 text-white/30">·</span>
            <Link to="/policy/partner_terms" className="hover:text-brand-400">
              Partner terms
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
