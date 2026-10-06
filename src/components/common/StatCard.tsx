import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  accent?: 'navy' | 'orange' | 'green' | 'red'
  hint?: string
}

const accentClasses = {
  navy: 'bg-navy-50 text-navy-600',
  orange: 'bg-orange-50 text-brand-orange-dark',
  green: 'bg-green-50 text-brand-green-dark',
  red: 'bg-red-50 text-brand-red',
}

export function StatCard({ label, value, icon: Icon, accent = 'navy', hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-navy-400">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-navy-800">{value}</p>
          {hint && <p className="mt-1 text-xs text-navy-300">{hint}</p>}
        </div>
        <div className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', accentClasses[accent])}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
