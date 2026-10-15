import { Play, Smartphone, type LucideIcon } from 'lucide-react'
import { site } from '@/config'

interface Store {
  label: string
  icon: LucideIcon
  url: string
}

const STORES: Record<'customer' | 'rider', Store[]> = {
  customer: [
    { label: 'Google Play', icon: Play, url: site.customerApp.android },
    { label: 'App Store', icon: Smartphone, url: site.customerApp.ios },
  ],
  rider: [{ label: 'Google Play', icon: Play, url: site.riderApp.android }],
}

/** App store buttons; a store without a link in config.ts shows "Coming soon". */
export function StoreButtons({ app, compact = false, className = '' }: { app: 'customer' | 'rider'; compact?: boolean; className?: string }) {
  const size = compact ? 'px-3.5 py-2 text-xs' : 'px-5 py-3 text-sm'
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {STORES[app].map(({ label, icon: Icon, url }) =>
        url ? (
          <a key={label} href={url} target="_blank" rel="noopener" className={`btn bg-white text-ink-950 hover:bg-brand-100 ${size}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </a>
        ) : (
          <span key={label} className={`btn cursor-default border border-white/15 text-white/60 ${size}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {label} · Coming soon
          </span>
        ),
      )}
    </div>
  )
}
