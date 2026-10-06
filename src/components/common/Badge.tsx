import type { ReactNode } from 'react'
import clsx from 'clsx'

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-green-50 text-brand-green-dark ring-green-200',
  warning: 'bg-orange-50 text-brand-orange-dark ring-orange-200',
  danger: 'bg-red-50 text-brand-red ring-red-200',
  neutral: 'bg-navy-50 text-navy-500 ring-navy-100',
  info: 'bg-blue-50 text-navy-500 ring-blue-200',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', toneClasses[tone])}>
      {children}
    </span>
  )
}
