import type { ReactNode } from 'react'

/** Dark banner at the top of an inner page. */
export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-400/10 blur-3xl" />
      <div className="container-x relative py-14 lg:py-20">
        <p className="eyebrow text-brand-400">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">{children}</div>}
      </div>
    </section>
  )
}
